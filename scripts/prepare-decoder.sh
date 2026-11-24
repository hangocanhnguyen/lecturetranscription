#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.10.tgz -o "$tmp/core.tgz"
(cd "$tmp" && echo 'd00089ce82e1bdf637ddbe42e0c3d41a1ba8cf4c9e825e7fa4d0bb970e844bd4  core.tgz' | sha256sum -c -)
tar -xzf "$tmp/core.tgz" -C "$tmp" package/dist/esm/ffmpeg-core.js package/dist/esm/ffmpeg-core.wasm
mkdir -p dist/vendor/ffmpeg-0.12.10
cp "$tmp/package/dist/esm/"* dist/vendor/ffmpeg-0.12.10/
