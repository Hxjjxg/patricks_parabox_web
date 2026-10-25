# Offline corner-edge audit evidence

Run e1–e5 from F:/parabox_web with Python, Pillow and NumPy. Every script
contains five source lines and writes only into this directory. No native
process, UI, network, production source or test changes are involved.

- e1-residual-repeat: literal4+10 residuals, all three native repeats and a
  nearest16 inspection montage. Columns native0/native1/native2/final; rows
  L-corner/left lower notch.
- e2-literal-samples: exact float-constant root, snapped source quads,
  unshifted pixel-center UVs, original four-texel values and weights.
- e3-local-underlay: all same-quad zero-alpha support samples within three
  pixels, sorted independently of color.
- e4-blend-predictions: source tint, both clamp/coverage models and all14
  actual versus predicted values, including unresolved raw errors.
- e5-native-texture-provenance: actual init.unity GUID mapping and recovered
  texture differences; recovered alpha does not remove the prediction gap.

The JSON is diagnostic evidence. The enlarged PNG is not a new capture or
visual parity approval. No new edge tolerance follows from these files.
