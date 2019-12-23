# hexes
A browser-based realtime multiplayer strategy game using Node.js and PixiJS.

## About the Game
The basis of the game is simple: a map is procedurally generated whenever a new match is created. Initially, every hex is unclaimed, and will proceed to accumulate 1 unit every 5 seconds. When a player joins, they are assigned a unique color identifier and given a single random hex on the map. The player's initial hex will be given `10 * (# of surrounding hexes)` additional units upon joining. Unlike unclaimed hexes, player hexes accumulate 3 units every 5 seconds. From there, the goal is to expand, conquer territory, and eliminate the other players' control of the map.

## Technical Info & Current Features
* Authoritative server model built on Node.js and Socket.IO.
* Clientside rendering handled by PixiJS.
* Procedurally generated maps
* Automated matchmaking with memory optimization
  - When players leaves a match, their qeued unit movements in the match's movement pool are stopped -- any units already in transit simply stop existing. Their hexes are then deallocated and their unique color identifier is pushed back to an array so it can be used by the next player to join. Any variables, timers, and references to the player are deleted.
  - If the player is the last to leave a match, all the above is carried out in addition to the complete removal of all variables, timers, and references involving the match.
  - This flow generally tries to keep memory usage to a minimum by forcing players to use all the available resources (matches) before creating new ones, opting to 'cycle' persistent data such as color identifiers, and ensuring the complete elimination of all data regarding a match (especially timers) when no longer in use.

## Usage

__(1).__ Navigate to `hexes/server` in the terminal and execute the `npm install` command to install the project dependencies from package.json.

__(2).__ While still in the `hexes/server` directory, execute `node server` to launch the gameserver.

__(3).__ Connect to the gameserver in your browser at `hostname`:8000.

That's it! Any clients connecting to the gameserver will either be funneled in to a match with an open player slot, or a new match will be created if all others are full.
