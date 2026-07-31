const CONFIG = {
  // Navigation bar — order determines display sequence
  timeline: [
    {
      id: "aerial",
      label: "Aerial View",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    },
    {
      id: "pool",
      label: "Pool",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M7 5v4M17 5v4M12 3v6"/></svg>`,
    },
    {
      id: "garden",
      label: "Garden",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 12 7 9 5 4c4 0 7 3 7 8z"/><path d="M12 12c0 0 5-3 7-8-4 0-7 3-7 8z"/></svg>`,
    },
    {
      id: "living",
      label: "Living Room",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0-4 0v2H7v-2a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/></svg>`,
    },
    {
      id: "kitchen",
      label: "Kitchen",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z"/><path d="M4 8h16"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/><path d="M10 12h4"/></svg>`,
    },
  ],

  // One entry per destination scene. `pois` are injected at runtime via renderPOIs().
  scenes: {
    aerial:  { video: "images/1.webm",      pois: [] },
    pool:    { video: "images/3.webm",      pois: [] },
    living:  { video: "images/l_loop.webm", pois: [] },
    garden:  { video: "images/j_loop.webm", pois: [] },
    kitchen: { video: "images/k_loop.webm", pois: [] },
  },

  // Image sequences used during scene transitions.
  // `reverse: true` reuses the same frames played backwards.
  sequences: {
    "aerial-to-pool":    { folder: "images/seq_arch/", prefix: "aereo_to_piscina_",   from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "pool-to-aerial":    { folder: "images/seq_arch/", prefix: "aereo_to_piscina_",   from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "pool-to-living":    { folder: "images/seq_arch/", prefix: "pool_to_living_",      from: 0, to: 72, pad: 2, ext: "jpg", fps: 60 },
    "living-to-pool":    { folder: "images/seq_arch/", prefix: "pool_to_living_",      from: 0, to: 72, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "pool-to-kitchen":   { folder: "images/seq_arch/", prefix: "pool_to_kitchen_",     from: 0, to: 72, pad: 2, ext: "jpg", fps: 60 },
    "kitchen-to-pool":   { folder: "images/seq_arch/", prefix: "pool_to_kitchen_",     from: 0, to: 72, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "pool-to-garden":    { folder: "images/seq_arch/", prefix: "pool_to_jardim_",      from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "garden-to-pool":    { folder: "images/seq_arch/", prefix: "pool_to_jardim_",      from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "aerial-to-garden":  { folder: "images/seq_arch/", prefix: "pano_jardim_",         from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "garden-to-aerial":  { folder: "images/seq_arch/", prefix: "pano_jardim_",         from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "aerial-to-kitchen": { folder: "images/seq_arch/", prefix: "pano_cozinha_",        from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "kitchen-to-aerial": { folder: "images/seq_arch/", prefix: "pano_cozinha_",        from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "aerial-to-living":  { folder: "images/seq_arch/", prefix: "pano_living_",         from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "living-to-aerial":  { folder: "images/seq_arch/", prefix: "pano_living_",         from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "living-to-kitchen": { folder: "images/seq_arch/", prefix: "living_to_kitchen_",   from: 0, to: 72, pad: 2, ext: "jpg", fps: 60 },
    "kitchen-to-living": { folder: "images/seq_arch/", prefix: "living_to_kitchen_",   from: 0, to: 72, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "garden-to-living":  { folder: "images/seq_arch/", prefix: "jardim_to_living_",    from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "living-to-garden":  { folder: "images/seq_arch/", prefix: "jardim_to_living_",    from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
    "garden-to-kitchen": { folder: "images/seq_arch/", prefix: "jardim_to_kitchen_",   from: 0, to: 47, pad: 2, ext: "jpg", fps: 60 },
    "kitchen-to-garden": { folder: "images/seq_arch/", prefix: "jardim_to_kitchen_",   from: 0, to: 47, pad: 2, ext: "jpg", fps: 60, reverse: true },
  },

  // Adjacency map: transitions[from][to] = sequenceId
  transitions: {
    aerial:  { pool: "aerial-to-pool",  garden: "aerial-to-garden",  kitchen: "aerial-to-kitchen", living: "aerial-to-living" },
    pool:    { aerial: "pool-to-aerial", living: "pool-to-living",    kitchen: "pool-to-kitchen",   garden: "pool-to-garden"   },
    living:  { pool: "living-to-pool",  kitchen: "living-to-kitchen", aerial: "living-to-aerial",  garden: "living-to-garden"   },
    kitchen: { pool: "kitchen-to-pool", living: "kitchen-to-living",  aerial: "kitchen-to-aerial", garden: "kitchen-to-garden"  },
    garden:  { pool: "garden-to-pool",  aerial: "garden-to-aerial",   living: "garden-to-living",  kitchen: "garden-to-kitchen" },
  },
};
