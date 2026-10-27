#!/usr/bin/env bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then echo "First run: installing Electron, this takes a minute..."; npm install || exit 1; fi
exec npm start
