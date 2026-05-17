export function loadPLY(url) {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load PLY: ${res.status}`);
      return res.text();
    })
    .then(text => parsePLY(text));
}

export function parsePLY(text) {
  const lines = text.split('\n');
  let lineIdx = 0;
  let vertexCount = 0;
  let hasColor = false;
  let format = 'ascii';
  let propX = -1, propY = -1, propZ = -1;
  let propR = -1, propG = -1, propB = -1;
  let readingHeader = true;
  let propIdx = 0;

  while (readingHeader && lineIdx < lines.length) {
    const line = lines[lineIdx++].trim();
    if (line === 'end_header') { readingHeader = false; break; }

    const parts = line.split(/\s+/);
    if (parts[0] === 'format') {
      format = parts[1] || 'ascii';
    }
    if (parts[0] === 'element' && parts[1] === 'vertex') {
      vertexCount = parseInt(parts[2], 10);
    }
    if (parts[0] === 'property') {
      if (parts[2] === 'x') propX = propIdx;
      else if (parts[2] === 'y') propY = propIdx;
      else if (parts[2] === 'z') propZ = propIdx;
      else if (parts[2] === 'red') { propR = propIdx; hasColor = true; }
      else if (parts[2] === 'green') propG = propIdx;
      else if (parts[2] === 'blue') propB = propIdx;
      if (parts[1] !== 'list') propIdx++;
    }
  }

  if (format !== 'ascii') {
    throw new Error(`PLY: unsupported format "${format}", only ASCII is supported`);
  }

  if (vertexCount === 0) throw new Error('PLY: no vertices found');

  const positions = new Float32Array(vertexCount * 3);
  const colors = (hasColor && propR >= 0 && propG >= 0 && propB >= 0)
    ? new Float32Array(vertexCount * 3) : null;
  let count = 0;

  for (let i = 0; i < vertexCount && lineIdx < lines.length; i++) {
    const line = lines[lineIdx++].trim();
    if (!line) continue;
    const vals = line.split(/\s+/).map(Number);
    if (vals.length < 3) continue;

    positions[count * 3]     = vals[propX] || 0;
    positions[count * 3 + 1] = vals[propY] || 0;
    positions[count * 3 + 2] = vals[propZ] || 0;

    if (colors) {
      colors[count * 3]     = (vals[propR] || 0) / 255;
      colors[count * 3 + 1] = (vals[propG] || 0) / 255;
      colors[count * 3 + 2] = (vals[propB] || 0) / 255;
    }
    count++;
  }

  return { positions: positions.subarray(0, count * 3), colors: colors ? colors.subarray(0, count * 3) : null, count };
}
