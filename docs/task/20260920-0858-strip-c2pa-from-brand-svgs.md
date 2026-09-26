# 20260920-0858-strip-c2pa-from-brand-svgs The brand SVGs carry the artwork and nothing else

- **status**: completed
- **priority**: P2
- **owner**: vtv87o8e/mica
- **createdAt**: 2026-09-20 08:58

## Description

Five SVGs under `website/public/` carried a c2pa manifest: a base64 provenance
blob in a `<metadata>` element, roughly 7.7 KB per file. It said which tool
produced the file, signed with that vendor's content-credentials chain.

Three reasons it does not belong:

- **It is most of the file.** `mica-os-icon.svg` was 8778 bytes, of which 1005
  are the artwork. Every visitor downloaded eight times the icon to receive a
  claim about who produced it.
- **It is not the source.** `micaoss/mica-res` holds the brand originals
  (`mica/brand/logo/`) and they are clean. The website's copies had been
  round-tripped through a tool that added the manifest and, on the way,
  rewrote the XML declaration and expanded every self-closing `<path/>`. The
  copies had silently stopped being copies.
- **A device ships one of them.** mica-core embeds the icon in the apid binary
  for the console's favicon, so the blob would have travelled into every
  image.

## What changed

The five files are the originals from `micaoss/mica-res` again, byte for byte:
`public/favicon.svg` and the four `public/assets/mica-os-*.svg`. mica-core's
embedded copy was replaced from the same source in the same pass, so the three
repositories now carry identical bytes.

## ActiveForm

Restoring the brand SVGs to their clean originals

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Checked across every repository in the workspace: no other tracked `.svg` or
`.png` carries a manifest, and `mica-res` was already clean.

`bun run test` in `website/` passes (16 files, 102 tests). The PNGs beside them
(`favicon-32.png`, `apple-touch-icon.png`) carry none.

- complete: clean originals restored in mica and mica-core
