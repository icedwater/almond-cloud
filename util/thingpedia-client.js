// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const ThingpediaDiscovery = require('thingpedia-discovery');

const Config = require('../config');

const db = require('./db');
const device = require('../model/device');
const organization = require('../model/organization');
const schema = require('../model/schema');
const exampleModel = require('../model/example');
const entityModel = require('../model/entity');

const S3_HOST = Config.S3_CLOUDFRONT_HOST + '/devices/';

const LEGACY_MAPS = {
    'linkedin': 'com.linkedin',
    'bodytrace-scale': 'com.bodytrace.scale',
    'twitter-account': 'com.twitter',
    'google-account': 'com.google',
    'facebook': 'com.facebook'
};

class ThingpediaDiscoveryDatabase {
    getByAnyKind(kind) {
        return db.withClient((dbClient) => device.getByAnyKind(dbClient, kind));
    }

    getAllKinds(deviceId) {
        return db.withClient((dbClient) => device.getAllKinds(dbClient, deviceId));
    }

    getByPrimaryKind(kind) {
        return db.withClient((dbClient) => device.getByPrimaryKind(dbClient, kind));
    }
}

var _discoveryServer = new ThingpediaDiscovery.Server(new ThingpediaDiscoveryDatabase());

const CATEGORIES = new Set(['media', 'social-network', 'home', 'communication', 'health', 'service', 'data-management']);

module.exports = class ThingpediaClientCloud {
    constructor(developerKey, locale) {
        this.developerKey = developerKey;
        // only keep the language part of the locale, we don't
        // yet distinguish en_US from en_GB
        this.language = (locale || 'en').split(/[-_@.]/)[0];
    }

    getModuleLocation(kind, version) {
        if (kind in LEGACY_MAPS)
            kind = LEGACY_MAPS[kind];

        if (version)
            return Promise.resolve(S3_HOST + kind + '-v' + version + '.zip');

        var developerKey = this.developerKey;

        return db.withClient((dbClient) => {
            return Promise.resolve().then(() => {
                if (developerKey)
                    return organization.getByDeveloperKey(dbClient, developerKey);
                else
                    return [];
            }).then((orgs) => {
                var org = null;
                if (orgs.length > 0)
                    org = orgs[0];

                return device.getByPrimaryKind(dbClient, kind).then((device) => {
                    if (device.fullcode)
                        throw new Error('No Code Available');

                    if (org !== null && ((org.id === device.owner) || org.is_admin))
                        return (S3_HOST + device.primary_kind + '-v' + device.developer_version + '.zip');
                    else if (device.approved_version !== null)
                        return (S3_HOST + device.primary_kind + '-v' + device.approved_version + '.zip');
                    else
                        throw new Error('Not Authorized');
                }, (e) => {
                    if (e.code === 'ENOENT') {
                        // = no such device, but we hide this fact and return a generic Not Authorized
                        throw new Error('Not Authorized');
                    } else {
                        throw e;
                    }
                });
            });
        });
    }

    getDeviceCode(kind) {
        var developerKey = this.developerKey;

        return db.withClient((dbClient) => {
            return Promise.resolve().then(() => {
                if (developerKey)
                    return organization.getByDeveloperKey(dbClient, developerKey);
                else
                    return [];
            }).then((orgs) => {
                var org = null;
                if (orgs.length > 0)
                    org = orgs[0];

                return device.getFullCodeByPrimaryKind(dbClient, kind, org);
            }).then((devs) => {
                if (devs.length < 1) {
                    const err = new Error('Not Found');
                    err.code = 'ENOENT';
                    throw err;
                }

                var dev = devs[0];
                var ast = JSON.parse(dev.code);
                ast.version = dev.version;
                if (dev.version !== dev.approved_version)
                    ast.developer = true;
                else
                    ast.developer = false;
                return ast;
            });
        });
    }

    getSchemas(schemas) {
        if (schemas.length === 0)
            return Promise.resolve({});
        var developerKey = this.developerKey;

        return db.withClient((dbClient) => {
            return Promise.resolve().then(() => {
                if (developerKey)
                    return organization.getByDeveloperKey(dbClient, developerKey);
                else
                    return [];
            }).then((orgs) => {
                var org = null;
                if (orgs.length > 0)
                    org = orgs[0];
                return schema.getTypesAndNamesByKinds(dbClient, schemas, org !== null ? (org.is_admin ? -1 : org.id) : null);
            }).then((rows) => {
                var obj = {};

                rows.forEach((row) => {
                    obj[row.kind] = {
                        kind_type: row.kind_type,
                        triggers: row.triggers,
                        actions: row.actions,
                        queries: row.queries
                    };
                });

                return obj;
            });
        });
    }

    getMetas(schemas) {
        if (schemas.length === 0)
            return Promise.resolve({});

        var developerKey = this.developerKey;

        return db.withClient((dbClient) => {
            return Promise.resolve().then(() => {
                if (developerKey)
                    return organization.getByDeveloperKey(dbClient, developerKey);
                else
                    return [];
            }).then((orgs) => {
                var org = null;
                if (orgs.length > 0)
                    org = orgs[0];

                return schema.getMetasByKinds(dbClient, schemas, org !== null ? (org.is_admin ? -1 : org.id) : null, this.language);
            }).then((rows) => {
                var obj = {};

                rows.forEach((row) => {
                    obj[row.kind] = {
                        kind_type: row.kind_type,
                        triggers: row.triggers,
                        actions: row.actions,
                        queries: row.queries
                    };
                });

                return obj;
            });
        });
    }

    _deviceMakeFactory(d) {
        const ast = JSON.parse(d.code);

        delete d.code;
        if (ast.auth.type === 'builtin') {
            d.factory = null;
        } else if (ast.auth.type === 'discovery') {
            d.factory = ({ type: 'discovery', category: d.category, kind: d.primary_kind, text: d.name,
                           discoveryType: ast.auth.discoveryType });
        } else if (ast.auth.type === 'interactive') {
            d.factory = ({ type: 'interactive', category: d.category, kind: d.primary_kind, text: d.name });
        } else if (ast.auth.type === 'none' &&
                   Object.keys(ast.params).length === 0) {
            d.factory = ({ type: 'none', category: d.category, kind: d.primary_kind, text: d.name });
        } else if (ast.auth.type === 'oauth2') {
            d.factory = ({ type: 'oauth2', category: d.category, kind: d.primary_kind, text: d.name });
        } else {
            d.factory = ({ type: 'form', category: d.category, kind: d.primary_kind, text: d.name,
                           fields: Object.keys(ast.params).map((k) => {
                               let p = ast.params[k];
                               return ({ name: k, label: p[0], type: p[1] });
                           })
                         });
        }
    }

    getDeviceSearch(q) {
        return db.withClient(async (dbClient) => {
            const org = await this._getOrg(dbClient);
            return device.getByFuzzySearch(dbClient, q, org);
        });
    }

    getDeviceList(klass, page, page_size) {
        return db.withClient(async (dbClient) => {
            const org = await this._getOrg(dbClient);
            if (klass) {
                if (['online','physical','data','system'].indexOf(klass) >= 0)
                    return device.getByCategory(dbClient, klass, org, page*page_size, page_size+1);
                else if (CATEGORIES.has(klass))
                    return device.getBySubcategory(dbClient, klass, org, page*page_size, page_size+1);
                else
                    throw new Error("Invalid class parameter");
            } else {
                return device.getAllApproved(dbClient, org, page*page_size, page_size+1);
            }
        }).then((devices) => {
            return ({ devices });
        });
    }

    getDeviceFactories(klass) {
        return db.withClient(async (dbClient) => {
            const org = await this._getOrg(dbClient);

            let devices;
            if (klass) {
                if (['online','physical','data','system'].indexOf(klass) >= 0)
                    devices = await device.getByCategoryWithCode(dbClient, klass, org);
                else if (CATEGORIES.has(klass))
                    devices = await device.getBySubcategoryWithCode(dbClient, klass, org);
                else
                    throw new Error("Invalid class parameter");
            } else {
                devices = await device.getAllApprovedWithCode(dbClient, org);
            }

            const factories = [];
            for (let d of devices) {
                const factory = this._deviceMakeFactory(d);
                if (factory)
                    factories.push(factory);
            }
            return factories;
        });
    }

    getDeviceSetup(kinds) {
        if (kinds.length === 0)
            return Promise.resolve({});

        return db.withClient(async (dbClient) => {
            const org = await this._getOrg(dbClient);

            for (let i = 0; i < kinds.length; i++) {
                 if (kinds[i] === 'messaging')
                     kinds[i] = Config.MESSAGING_DEVICE;
            }

            const devices = await device.getDevicesForSetup(dbClient, kinds, org);
            const result = {};
            devices.forEach((d) => {
                try {
                    this._deviceMakeFactory(d);
                    if (d.factory) {
                        if (d.for_kind in result) {
                            if (result[d.for_kind].type !== 'multiple') {
                                 let first_choice = result[d.for_kind];
                                 result[d.for_kind] = { type: 'multiple', choices: [first_choice] };
                            }
                            result[d.for_kind].choices.push(d.factory);
                        } else {
                            result[d.for_kind] = d.factory;
                        }
                        if (d.for_kind === Config.MESSAGING_DEVICE)
                            result['messaging'] = d.factory;
                    }
                } catch(e) { /**/ }
            });

            for (let kind of kinds) {
                if (!(kind in result))
                    result[kind] = { type: 'multiple', choices: [] };
            }

            return result;
        });
    }

    // FIXME: remove this when almond-dialog-agent is fixed to use getDeviceSetup
    getDeviceSetup2(kinds) {
        return this.getDeviceSetup(kinds);
    }

    getKindByDiscovery(body) {
        return Promise.resolve().then(() => _discoveryServer.decode(body));
    }

    async _getOrg(dbClient) {
        const [org] = await organization.getByDeveloperKey(dbClient, this.developerKey);
        return org || null;
    }
    async _getOrgId(dbClient) {
        const org = await this._getOrg(dbClient);
        if (org === null)
            return null;
        else if (org.is_admin)
            return -1;
        else
            return org.id;
    }

    getExamplesByKey(key) {
        return db.withClient(async (dbClient) => {
            return exampleModel.getByKey(dbClient, key, await this._getOrgId(dbClient), this.language);
        });
    }

    getExamplesByKinds(kinds) {
        if (kinds.length === 0)
            return Promise.resolve([]);
        return db.withClient(async (dbClient) => {
            return exampleModel.getByKinds(dbClient, kinds, await this._getOrgId(dbClient), this.language);
        });
    }

    clickExample(exampleId) {
        return db.withClient((dbClient) => {
            return exampleModel.click(dbClient, exampleId);
        });
    }

    lookupEntity(entityType, searchTerm) {
        return db.withClient((dbClient) => {
            return Promise.all([entityModel.lookupWithType(dbClient, this.language, entityType, searchTerm),
                                entityModel.get(dbClient, entityType, this.language)]);
        }).then(([rows, meta]) => {
            const data = rows.map((r) => ({ type: r.entity_id, value: r.entity_value, canonical: r.entity_canonical, name: r.entity_name }));
            data.meta = { name: meta.name, has_ner_support: meta.has_ner_support, is_well_known: meta.is_well_known };
            return data;
        });
    }
};
module.exports.prototype.$rpcMethods = ['getAppCode', 'getApps',
                                        'getModuleLocation', 'getDeviceCode',
                                        'getSchemas', 'getMetas',
                                        'getDeviceSetup', 'getDeviceSetup2',
                                        'getDeviceFactories',
                                        'getDeviceList',
                                        'getDeviceSearch',
                                        'getKindByDiscovery',
                                        'getExamplesByKinds', 'getExamplesByKey',
                                        'clickExample', 'lookupEntity'];
