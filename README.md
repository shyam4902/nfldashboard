# NFL Dashboard Static App

Standalone static dashboard. The Props & Value tab reads the canonical board
at `~/Library/Application Support/nfldashboard-props/nfldashboard/props-board.json`
when served from the deployed runtime. Use `fantasyfootball/scripts/install-launchd.sh`
to deploy this page and every local JSON asset it fetches together.

For a standalone source checkout preview, serve the deployed runtime directory
rather than the Desktop checkout so the page and export always read the same
live state.
