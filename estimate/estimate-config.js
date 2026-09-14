// Production configuration for JVA Remodeling estimate requests.
// These are public HTTPS function endpoints; no password or private key belongs here.
window.JVA_ESTIMATE_CONFIG = {
  createEndpoint: "https://us-central1-jva-remodeling.cloudfunctions.net/createEstimateRequest",
  finalizeEndpoint: "https://us-central1-jva-remodeling.cloudfunctions.net/finalizeEstimateRequest",
  maxFiles: 10,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 50 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024
};
