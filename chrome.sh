#!/bin/bash

cd src
cp chrome_manifest.json manifest.json
zip -r ../extension.zip . -x "*.DS_Store" -x "web-ext-artifacts/*" -x "firefox_manifest.json" -x "chrome_manifest.json"
rm manifest.json
