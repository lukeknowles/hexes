# hexes
A browser-based realtime multiplayer strategy game using Node.js and PixiJS.

## Usage

__(1).__ Navigate to `hexes/server` in the terminal and execute the `npm install` command to install the project dependencies from package.json.

__(2).__ While still in the `hexes/server` directory, execute `node server` to launch the gameserver.

__(3).__ Connect to the gameserver in your browser at `hostname`:8000.

That's it! Any clients connecting to the gameserver will either be funneled in to the most recently created match, or a new one will be created if said match is full.
