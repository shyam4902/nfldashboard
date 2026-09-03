// Shared atomic file write for dashboard writers that produce tracked
// artifacts. Writes to a same-directory temp file, then renames over the
// destination — an interrupted write can never leave a truncated/corrupt
// tracked JSON/TXT in place. Same-directory rename is atomic on POSIX.
'use strict';

const fs = require('fs');
const path = require('path');

function atomicWriteFileSync(file, data, options = 'utf8') {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* best effort */ }
    throw err;
  }
}

module.exports = { atomicWriteFileSync };