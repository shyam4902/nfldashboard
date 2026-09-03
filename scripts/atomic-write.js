// Shared atomic file write for dashboard writers that produce tracked
// artifacts. Writes to a same-directory temp file, then renames over the
// destination — an interrupted write can never leave a truncated/corrupt
// tracked JSON/TXT in place. Same-directory rename is atomic on POSIX.
//
// Temp names are unique per process (pid) AND per call (monotonic counter), so
// concurrent publishers — separate processes, or repeated calls inside one —
// can never share a temp path or overwrite each other mid-write.
'use strict';

const fs = require('fs');
const path = require('path');

let seq = 0;

function atomicWriteFileSync(file, data, options = 'utf8') {
  seq += 1;
  const tmp = `${file}.tmp-${process.pid}-${seq}`;
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* best effort */ }
    throw err;
  }
}

module.exports = { atomicWriteFileSync };
