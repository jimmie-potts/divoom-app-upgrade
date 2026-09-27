// Ports of the owner's installed services on this PC. A verification run never
// binds, reaches or pairs with one. Dependency-free, so the transport guard can
// import it before anything else loads.
export const installedPorts:readonly number[]=[8765,8787,8788,8791,41230,41231];
