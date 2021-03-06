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

const Q = require('q');
const express = require('express');
const path = require('path');

const db = require('../util/db');
const organization = require('../model/organization');
const device = require('../model/device');
const oauth2 = require('../model/oauth2');

const EngineManager = require('../almond/enginemanagerclient');

var router = express.Router();

router.get('/', (req, res) => {
    Promise.resolve().then(() => {
        if (req.user)
            return EngineManager.get().isRunning(req.user.id);
        else
            return false;
    }).then((isRunning) => {
        if (req.user && req.user.developer_org !== null) {
            return db.withClient((dbClient) => {
                return Q.all([isRunning,
                              organization.get(dbClient, req.user.developer_org),
                              organization.getMembers(dbClient, req.user.developer_org),
                              device.getByOwner(dbClient, req.user.developer_org),
                              oauth2.getClientsByOwner(dbClient, req.user.developer_org)]);
            });
        } else {
            return [isRunning, {}, [], []];
        }
    }).then(([isRunning, developer_org, developer_org_members, developer_devices, developer_oauth2_clients]) => {
        res.render('thingpedia_dev_portal', { page_title: req._("Thingpedia - Developer Portal"),
                                              isRunning: isRunning,
                                              csrfToken: req.csrfToken(),
                                              developer_org_name: developer_org.name,
                                              developer_org_members: developer_org_members,
                                              developer_devices: developer_devices,
                                              developer_oauth2_clients: developer_oauth2_clients
        });
    }).catch((e) => {
        res.status(400).render('error', { page_title: req._("Thingpedia - Error"),
                                          message: e });
    });
});

for (let doc of require('../doc/doc-list.json')) {
    router.get('/' + doc + '.md', (req, res, next) => {
        res.render('doc_' + doc, {
            page_title: req._("Thingpedia - Documentation"),
            currentPage: doc
        });
    });
}

router.use('/thingpedia-api', express.static(path.join(__dirname, '../doc/thingpedia-api')));

module.exports = router;
