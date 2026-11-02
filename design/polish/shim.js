/* Design-preview shim. Used only by the design/polish/v1-v4 pages, never by the
   live site. Load order: fixtures/manifest.js, then this file, then the page.

   1. Freezes the clock at POLISH.now, so "today" is the frozen date.
   2. Answers every ESPN request from design/polish/fixtures/. A request with
      no saved file gets a 404, which the page shows as its normal error state:
      nothing is filled in or made up.
   3. Adds a one-line note above the page saying the data is frozen. */
(function () {
  'use strict';
  var M = window.POLISH;
  if (!M) throw new Error('design/polish: load fixtures/manifest.js before shim.js');
  var base = new URL('./fixtures/', document.currentScript.src);
  var have = new Set(M.files);

  var RealDate = Date;
  var FROZEN = RealDate.parse(M.now);
  function FrozenDate() {
    var args = Array.prototype.slice.call(arguments);
    if (!(this instanceof FrozenDate)) return new RealDate(FROZEN).toString();
    return args.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(args)))() : new RealDate(FROZEN);
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = function () { return FROZEN; };
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  window.Date = FrozenDate;

  var BOARD = {
    avgPoints: 'points', avgRebounds: 'rebounds', avgAssists: 'assists',
    avgSteals: 'steals', avgBlocks: 'blocks', avgThreePointFieldGoalsMade: 'threes',
  };

  // ESPN URL to fixture file name, or '' when the URL is not an ESPN call.
  function fileFor(url) {
    var u = decodeURIComponent(String(url));
    if (!/espn\.com\//.test(u)) return '';
    var m;
    if ((m = /\/scoreboard\?dates=(\d{8})/.exec(u))) return 'scoreboard-' + m[1] + '.json';
    if ((m = /\/summary\?event=(\d+)/.exec(u))) return 'summary-' + m[1] + '.json';
    if (/\/standings(\?|$)/.test(u)) return 'standings.json';
    if ((m = /\/teams\/(\d+)\/(statistics|schedule|roster)/.exec(u))) return 'team-' + m[1] + '-' + m[2] + '.json';
    if ((m = /\/byathlete\?.*sort=[a-z]+\.([A-Za-z]+):/.exec(u))) return 'leaders-' + (BOARD[m[1]] || m[1]) + '.json';
    if ((m = /\/athletes\/(\d+)\/(overview|gamelog)/.exec(u))) return 'athlete-' + m[1] + '-' + m[2] + '.json';
    if ((m = /\/athletes\/(\d+)(\?|$)/.exec(u))) return 'athlete-' + m[1] + '.json';
    return 'unsaved';
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var file = fileFor(url);
    if (!file) return realFetch(input, init);
    if (init && init.signal && init.signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    if (!have.has(file)) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'not in the frozen set', file: file }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return realFetch(new URL(file, base).href);
  };

  function note() {
    var bar = document.createElement('div');
    bar.className = 'polish-note';
    bar.innerHTML = '<span><b>Design preview</b> · frozen ESPN data from ' + M.label + '</span><a href="../">All variants</a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) note();
  else document.addEventListener('DOMContentLoaded', note);
})();
