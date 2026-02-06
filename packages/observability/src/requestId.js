export function newRequestId() {
    // suficientemente único para logs; no necesitamos crypto fuerte acá
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
