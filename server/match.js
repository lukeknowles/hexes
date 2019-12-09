//module.exports = {};
var async = require("async");
var FastMap = require("collections/fast-map");
var Player = require("./player");
var Pathfinding = require("./pathfinding");
var PriorityQueue = require("./priorityqueue");

function Match(_map, _gameWorld, _rows, _cols, _roomId, _io)
{
	this.io = _io;
	this.map = _map;
	this.gameWorld = _gameWorld;
	this.rows = _rows;
	this.cols = _cols;
	this.roomId = _roomId;
	this.players = new FastMap();
	this.movementPool = new FastMap();
	this.playerColors = [
		{color: "red", code: 0xbc2721},
		{color: "blue", code: 0x204fbc},
		{color: "teal", code: 0x1dd1c7},
		{color: "purple", code: 0x8430a5},
		{color: "orange", code: 0xff8316},
		{color: "brown", code: 0x6b3405},
		{color: "yellow", code: 0xe8c500},
		{color: "green", code: 0x11540c}
	];
	this.tick = 10;
	this.tickTimer = null;
	this.tickInterval = null;
	this.movementPool = new FastMap();
	this.hexOwnershipAmounts = {};
	let self = this;

	this.joinPlayer = function(_id) {
		let color = self.playerColors.pop();
		let ply = new Player(color);
		self.players.set(_id, ply);
		_io.to(self.roomId).send("PJOIN", color);
		self.hexOwnershipAmounts[_id] = 1;
	}

	this.leavePlayer = function(_id) {
		let ply = self.players.get(_id);
		self.playerColors.push(ply.colorData);
		self.players.delete(_id);
		_io.to(self.roomId).send("PLEAV", ply.colorData);
		self.hexOwnershipAmounts[_id] = null;
	}

	this.startIncrementingUnits = function() {
		var now = Date();
		var delay = (3 * 1000) - now % (3 * 1000);
		
		self.tickTimer = setTimeout(function()
		{
			self.tickInterval = setInterval(function()
			{
				//if(self.stop) { clearInterval(this); }
				async.each(self.gameWorld, function (row, rowLoop) {
					async.each(row, function (hex, colLoop) {
						if(hex != null) {
							if(hex.owner == null)
							{
								hex.units += 1;
							}
							else
							{
								hex.units += 3;
							}
						}
						colLoop(); 
					}, function(err) {
						//Finished looping through cols
						rowLoop();
					});
				}, function(err) {
					//Finished looping through rows
					self.tick += 1;
					console.log(self.tick);
					_io.to(self.roomId).send("INC");
				});
			}, 3*1000);
		}, delay);
	}
	
	this.getHex = function(r, c) {
		return({
			row: self.gameWorld[r][c].row,
			col: self.gameWorld[r][c].col,
			units: self.gameWorld[r][c].units,
			owner: self.gameWorld[r][c].owner,
			checksum: self.gameWorld[r][c].checksum
		});
	}

	this.isValidHexPosition = function(row, col) {
		return((row >= 0 && col >= 0 && row < self.rows && col < self.cols) && (self.map[row] != null && self.map[row][col] != null));
	}

	this.getNeighbors = function(row, col) {
		let neighbors = [];

		if(self.isValidHexPosition(row-1, col)) { neighbors.push(self.getHex(row-1, col)); } // UP
		if(self.isValidHexPosition(row, col+1)) { neighbors.push(self.getHex(row, col+1)); } // RIGHT
		if(self.isValidHexPosition(row+1, col)) { neighbors.push(self.getHex(row+1, col)); } // DOWN
		if(self.isValidHexPosition(row, col-1)) { neighbors.push(self.getHex(row, col-1)); } // LEFT
		
		if(col % 2 == 0) //even col, get the hexes to the NE and NW
		{
			if(self.isValidHexPosition(row-1, col-1)) { neighbors.push(self.getHex(row-1, col-1)); }
			if(self.isValidHexPosition(row-1, col+1)) { neighbors.push(self.getHex(row-1, col+1)); }
		}
		else
		{
			if(self.isValidHexPosition(row+1, col-1)) { neighbors.push(self.getHex(row+1, col-1)); }
			if(self.isValidHexPosition(row+1, col+1)) { neighbors.push(self.getHex(row+1, col+1)); }
		}

		return(neighbors);
	}

	this.getVisibleWorld = function(id) {
		console.time("GENERATE_VISIBLE_WORLD");
		var visible = JSON.parse(JSON.stringify(self.map));
		var r = 0;
		var c = -1;

		async.each(self.gameWorld, function (row, rowLoop) {
			async.each(row, function (hex, colLoop) {
				c++;
				if(self.players.has(id) && (hex != null && hex.owner == id)) {
					//visible[r][c] = {"row":hex.row,"col":hex.col,"units":hex.units,"owner":hex.owner};
					visible[r][c] = self.getHex(r, c);
					visible[r][c].color = self.players.get(id).colorData.code;
					var neighbors = self.getNeighbors(r, c);

					neighbors.forEach(function(n) {
						visible[n.row][n.col] = self.getHex(n.row, n.col);
						//visible[n.row][n.col] = {"row":self.gameWorld[n.row][n.col].row,"col":self.gameWorld[n.row][n.col].col,"units":self.gameWorld[n.row][n.col].units,"owner":gameWorld[n.row][n.col].owner};
						if(((self.gameWorld[n.row][n.col] != null) && (self.gameWorld[n.row][n.col].owner != null)) && self.players.has(self.gameWorld[n.row][n.col].owner)) {
							visible[n.row][n.col].color = self.players.get(self.gameWorld[n.row][n.col].owner).colorData.code;
							if(self.gameWorld[n.row][n.col].owner != id)
							{
								visible[n.row][n.col].owner = "^";
							}
						}
					});
				}
			colLoop(); 
			}, function(err) {
				c = -1;
				r++;
				rowLoop();
			});
			}, function(err) {
		});
		console.timeEnd("GENERATE_VISIBLE_WORLD");
		console.log("id: " + id);
		return(visible);
	}

	this.getUnclaimedHexes = function(single, callback)
	{
		var unclaimed = [];
	
		async.each(self.gameWorld, function (row, rowLoop) {
			async.each(row, function (hex, colLoop) {
				if(hex != null && hex.owner == null) {
					unclaimed.push(hex);
				}
				colLoop(); 
			}, function(err) {
			  //Finished looping through cols
			  rowLoop();
			});
		}, function(err) {
			if(single)
			{
				callback(unclaimed[Math.floor(Math.random()*unclaimed.length)]);
			}
			else
			{
				callback(unclaimed);
			}
		});
	}

	this.changeHexOwner = function(_row, _col, _newOwner) {
		let previousOwner = self.gameWorld[_row][_col].owner;

		if(previousOwner != null) { self.hexOwnershipAmounts[previousOwner] -= 1; }
		if(_newOwner != null) { self.hexOwnershipAmounts[_newOwner] += 1; }
		
		self.gameWorld[_row][_col].owner = _newOwner;
	}

	this.freeHexesFromOwner = function(_owner, callback) {
		var i = 0;
		async.each(self.gameWorld, function (row, rowLoop) {
		  async.each(row, function (hex, colLoop) {
			if(hex != null && hex.owner == id) {
				i++
				self.changeHexOwner(hex.row, hex.col, null);
			}
			colLoop(); 
			}, function(err) {
			  rowLoop();
			});
		  }, function(err) {
			callback(i);
		});
	}

	this.findPath = function(origin, destination) {
		let frontier = new PriorityQueue((a, b) => a[1] > b[1]);
		let cameFrom = {};
		let costSoFar = {};

		frontier.push([{row: origin.row, col: origin.col, checksum: origin.checksum},0]);
		cameFrom[origin.checksum] = "NONE";
		costSoFar[origin.checksum] = 0;
		let last = null;

		while(!frontier.isEmpty())
		{
			let current = frontier.pop()[0];

			if(current.row == destination.row && current.col == destination.col)
			{
				return self.rebuildPath([current.row, current.col], cameFrom);
				break;
			}

			self.getNeighbors(current.row, current.col).forEach(function(n) {
				if((n.checksum != destination.checksum) && (n.owner != origin.owner)) { return; }

				let newCost = costSoFar[current.checksum] + (Pathfinding.moveCost(current, n));

				if(costSoFar[n.checksum] == null || newCost < costSoFar[n.checksum])
				{
					costSoFar[n.checksum] = newCost;
					let priority = -(newCost + (Pathfinding.moveCost(destination, n) * 3));
					frontier.push([n, priority]);
					cameFrom[[n.row,n.col]] = [current.row, current.col];
				}
			});
		}
	}

	this.rebuildPath = function(current, cameFrom)
	{
			let finalPath = [];
			var that = this;
			finalPath.push(current);

			while(cameFrom[current] != null)
			{
				current = cameFrom[current];
				finalPath.push(current);
			}
			return(finalPath.reverse());
	}

	this.RouteQueue = function(_route, _units, _owner, _id) {
		//this.owner = _owner;
		let route = _route;
		let units = _units;
		let owner = _owner;
		let progress = 0;
		let id = _id;
		let moveInterval;
		let moveTimeOut;
	
		let destroy = function()
		{
			clearTimeout(moveTimeOut);
			clearInterval(moveInterval);
			self.movementPool.delete(id);
		}
	
		let init = function()
		{
			currentNode = route[0];
			moveToNextNode();
		}
	
		let moveToNextNode = function()
		{
			let now = Date();
			let delay = (3 * 1000) - now % (3 * 1000);
	
			moveTimeOut = setTimeout(function()
			{
				let sentOut = [];
	
				self.gameWorld[route[0][0]][route[0][1]].units -= units;
	
				let curNeighbors = self.getNeighbors(route[0][0], route[0][1]);
				_io.to(owner).emit("moveUnits", {initial: true, originRow: route[0][0], originCol: route[0][1], destinationRow: route[1][0], destinationCol: route[1][1], units: units, unitOwner: owner});
	
				for(let i = 0; i < curNeighbors.length; i++)
				{
					if(curNeighbors[i].owner == owner) { continue; }
					if(!sentOut.includes(curNeighbors[i].owner))
					{
						_io.to(curNeighbors[i].owner).emit("moveUnits", {initial: true, originRow: route[0][0], originCol: route[0][1], destinationRow: route[1][0], destinationCol: route[1][1], units: units, unitOwner: owner});
						sentOut.push(curNeighbors[i].owner);
					}
				}
	
				moveInterval = setInterval(function()
				{
					if(self == null)
					{
						clearInterval(moveInterval);
						clearTimeout(moveTimeOut);
						//destroy();
						return;
					}

					if(progress >= route.length - 1)
					{
						clearInterval(moveInterval);
						clearTimeout(moveTimeOut);
						destroy();
					}
					else
					{
						progress += 1;
	
						let fromRow = route[progress-1][0];
						let fromCol = route[progress-1][1];
						let toRow = route[progress][0];
						let toCol = route[progress][1];
	
						let sent = [];
						if(progress != route.length - 1)
						{
							self.getNeighbors(toRow, toCol).forEach(function(n) {
								if(sent.includes(n.owner)) { return; }
								sent.push(n.owner);
								_io.to(n.owner).emit("moveUnits", {originRow: route[progress][0], originCol: route[progress][1], destinationRow: route[progress+1][0], destinationCol: route[progress+1][1], units: units, unitOwner: owner});
							});
						}
						else
						{
							if(self.gameWorld[toRow][toCol].owner == owner)
							{
								self.gameWorld[toRow][toCol].units += units;
							}
							
							if(self.gameWorld[toRow][toCol].owner != owner)
							{
								if(self.gameWorld[toRow][toCol].units - units < 0)
								{
									self.changeHexOwner(toRow, toCol, owner);
								}
								self.gameWorld[toRow][toCol].units = Math.abs(self.gameWorld[toRow][toCol].units - units);
							}
						}
	
						let neighbors = self.getNeighbors(toRow, toCol).concat(self.getNeighbors(fromRow, fromCol));
						let sentUpdate = [];
						for(var i = 0; i < neighbors.length; i++)
						{
	
							let neighborOwner = self.gameWorld[neighbors[i].row][neighbors[i].col].owner;
	
							if(sentUpdate.includes(neighborOwner)) { continue; }
	
							if(neighborOwner != null)
							{
								_io.to(neighborOwner).emit("updateWorld", self.getVisibleWorld(neighborOwner));
								sentUpdate.push(neighborOwner);
							}
						}
					}
				}, 3*1000);
			}, delay);
		}
		init();
	}

	this.moveUnits = function(_fromOwner, _fromRow, _fromCol, _toRow, _toCol, _amount) {
		if((_amount > 0) && (self.gameWorld[_fromRow][_fromCol].owner == _fromOwner))
		{
			if(_amount > self.gameWorld[_fromRow][_fromCol].units) { _amount = self.gameWorld[_fromRow][_fromCol].units; }
			let path = self.findPath(self.getHex(_fromRow, _fromCol), self.getHex(_toRow, _toCol));
			
			if(path != null)
			{
				
				let randomId = Math.floor((Math.random() * 9999) + 1000);
				self.movementPool.add(new self.RouteQueue(path, _amount, _fromOwner, randomId), randomId);
				
				console.log("[MOVE]: " + _fromOwner + " moved " + _amount + " UNITS from [" + _fromRow + ", " + _fromCol + "] to [" + _toRow + ", " + _toCol + "]");
			}
			else
			{
				console.log("[MOVE ERROR]: " + _fromOwner + " tried to move " + _amount + " UNITS from [" + _fromRow + ", " + _fromCol + "] to [" + _toRow + ", " + _toCol + "]. Denied: No valid path.");
			}
		}
		else
		{
			console.log("[MOVE ERROR]: " + _fromOwner + " tried to move " + _amount + " UNITS from [" + _fromRow + ", " + _fromCol + "] to [" + _toRow + ", " + _toCol + "]. Denied: not enough units.");
		}
	}

	this.destroy = function()
	{
		clearInterval(self.tickInterval);
		clearTimeout(self.tickTimer);
		self.map = null;
		self.gameWorld = null;
		self.rows = null;
		self.cols = null;
		self.roomId = null;
		self.players = null;
		self.movementPool = null;
		self.playerColors = null;
		self.tick = null;
		self.tickTimer = null;
		self.tickInterval = null;
		self = null;
	}
}

module.exports = Match;