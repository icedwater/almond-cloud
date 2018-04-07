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

// The location where icons and zip files are stored
// This can be an absolute URI ending in cloudfront.net, which enables the
// S3 storage backend, or the exact string "/download", which enables the
// local storage backend
module.exports.S3_CLOUDFRONT_HOST = 'https://d1ge76rambtuys.cloudfront.net';
module.exports.THINGENGINE_MANAGER_ADDRESS = './control';
module.exports.THINGENGINE_DIRECT_ADDRESS = './direct';
module.exports.BING_KEY = '76e02e969871428196e80ecfb364bf65';

// set this to 'embedded' to enable the embedded Thingpedia,
// to 'external' to use the Thingpedia at THINGPEDIA_URL;
module.exports.WITH_THINGPEDIA = 'embedded';
// this is used to construct links to Thingpedia, eg from My Almond
// it MUST be empty if the embedded Thingpedia is to be used
module.exports.THINGPEDIA_URL = '';
// set to true if this is serving https://thingpedia.stanford.edu
// (enables redirect from legacy domains and sets Strict-Transport-Security
// headers)
module.exports.IS_PRODUCTION_THINGPEDIA = true;

module.exports.SEMPRE_URL = 'https://almond-nl.stanford.edu';

// set to true to let users try out Almond without logging in
// they will operate as the user "anonymous"
module.exports.ENABLE_ANONYMOUS_USER = true;

// the following should be set in secret_config.js (which is not checked
// into git) or not set at all

// URL and access token for a server that supports autotraining when
// devices are updated in Thingpedia
module.exports.TRAINING_URL = null;
module.exports.TRAINING_ACCESS_TOKEN = null;

// OAuth Client secrets to support Login With Google / Login With Facebook
module.exports.GOOGLE_CLIENT_SECRET = null;
module.exports.FACEBOOK_APP_SECRET = null;

// Mailgun user/password to handle the "Request Developer Access" form
module.exports.MAILGUN_USER = null;
module.exports.MAILGUN_PASSWORD = null;

// load more configuration that should not go in git (eg secret keys)
try {
    Object.assign(module.exports, require('./secret_config.js'));
} catch(e) {}
