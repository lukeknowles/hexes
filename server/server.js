var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var async = require("async");
var PriorityQueue = require("./priorityqueue");
var Pathfinding = require("./pathfinding");
var Map = require("collections/map");
var FastMap = require("collections/fast-map");
var Match = require("./match");


var matches = new Map();

var NUM_COLS = 25;
var NUM_ROWS = 10;

function Hex(_r, _c, _u, _o)
{
	this.row = _r;
	this.col = _c;
	this.units = _u;
	this.owner = _o;
	this.checksum = ((1/2)*(_r+_c)*(_r+_c+1)+_c);
}

function getHex(r, c)
{
	return({
		row: gameWorld[r][c].row,
		col: gameWorld[r][c].col,
		units: gameWorld[r][c].units,
		owner: gameWorld[r][c].owner,
		checksum: gameWorld[r][c].checksum
	});
}

function generateRandomString(len)
{
	return([...Array(len)].map(i=>(~~(Math.random()*36)).toString(36)).join(''));
}

function generateMap(rows, cols, map, world, callback)
{	
	for(var r = 0; r < rows; r++)
	{
		map[r] = [];
		world[r] = [];
		
		for(var c = 0; c < cols; c++) //c++ ehuhue
		{
			map[r][c] = "*";
			world[r][c] = new Hex(r, c, 1, null);
		}
	}
	callback(map, world);
}

function generateHoles(map, world, iterations, maxExtend, callback)
{
	for(var i = 0; i < iterations; i++)
	{
		var hexRow = Math.floor(Math.random() * NUM_ROWS);
		var hexCol = Math.floor(Math.random() * NUM_COLS);
		var neighborsToRemove = Math.floor(Math.random() * (maxExtend - 0 + 1)) + 0;
		
		if(map[hexRow][hexCol] != null) 
		{ 
			map[hexRow][hexCol] = null;
			world[hexRow][hexCol] = null;
		}
				
		for(n = 0; n < neighborsToRemove; n++)
		{
			var direction = Math.floor(Math.random() * (3 - 0 + 1)) + 0;
					
			switch(direction)
			{	
				//UP
				case 0:
					if(isValidHexPosition(map, hexRow, hexCol, 0, -1))
					{
						var newRow = parseInt(hexRow - 1);
							
						map[newRow][hexCol] = null;
						world[newRow][hexCol] = null;
					}
					break;
					
				//RIGHT					
				case 1:
					if(isValidHexPosition(map, hexRow, hexCol, 1, 0))
					{
						var newCol = parseInt(hexCol + 1);

						map[hexRow][newCol] = null;
						world[hexRow][newCol] = null;
					}
					break;
					
				//DOWN
				case 2:
					if(isValidHexPosition(map, hexRow, hexCol, 0, 1))
					{
						var newRow = parseInt(hexRow + 1);
						map[newRow][hexCol] = null;
						world[newRow][hexCol] = null;
					}
					break;
					
					//LEFT
				case 3:
					if(isValidHexPosition(map, hexRow, hexCol, -1, 0))
					{
						var newCol = parseInt(hexCol - 1);
						map[hexRow][newCol] = null;
						world[hexRow][newCol] = null;
					}
					break;
						
				case 4:
					if(isValidHexPosition(map, hexRow, hexCol, 1, -1))
					{
						var newRow = parseInt(hexRow - 1);
						var newCol = parseInt(hexCol + 1);
						
						map[newRow][newCol] = null;
						world[hexRow][newCol] = null;
					}
					break;
						
				case 5:
					if(isValidHexPosition(map, hexRow, hexCol, -1, 1))
					{
						var newRow = parseInt(hexRow + 1);
						var newCol = parseInt(hexCol - 1);
						
						map[newRow][newCol] = null;
						world[newRow][newCol] = null;
					}
					break;
			}
		}
	}
	callback(map, world);
}

function deleteLoneHexes(map, world, callback)
{
	for(var r = 0; r < NUM_ROWS; r++)
	{
		for(var c = 0; c < NUM_COLS; c++)
		{
			if(map[r][c] != null)
			{
				if(!isValidHexPosition(map, r, c, 0, -1) && !isValidHexPosition(map, r, c, 1, 0) && !isValidHexPosition(map, r, c, 0, 1) && !isValidHexPosition(map, r, c, -1, 0))
				{
					map[r][c] = null;
					world[r][c] = null;
				}
			}
		}
	}
	callback(map, world);
}

function createNewMatch(rows, cols, removalIterations, removalRange, callback)
{
	var map = [[],[]];
	var world = [[],[]];

	generateMap(rows, cols, map, world, function(initMap, initWorld)
	{
	    generateHoles(initMap, initWorld, removalIterations, removalRange, function(holeMap, holeWorld)
	    {
				deleteLoneHexes(holeMap, holeWorld, function(finalMap, finalWorld)
				{
					let newMatchId = generateRandomString(12);
					let m = new Match(finalMap, finalWorld, rows, cols, newMatchId, io);
					m.startIncrementingUnits();
					matches.set(newMatchId, m);
					callback(m);
				});
	    });
	});
}

function assignPlayerToMatch(_socketId, callback)
{
	let joined = false;

	for(var [k,v] of matches) {
		if(v.players.length < 8 && !joined)
		{
			joined = true;
			v.joinPlayer(_socketId);
			callback(v.roomId);
		}
	};

	if(!joined)
	{
		createNewMatch(10, 25, 10, 10, function(match) {
			match.joinPlayer(_socketId);
			callback(match.roomId);
		});
	}
}
		
function isValidHexPosition(map, originRow, originCol, horizMove, vertMove)
{	
	var destRow = originRow;
	var destCol = originCol;

	var illegalMove = false;

	if(vertMove > 0)
	{
		if(originRow + vertMove > NUM_ROWS - 1) { return false; }
		destRow = (originRow + vertMove);
	}
	
	if(vertMove < 0)
	{	
		if((originRow - Math.abs(vertMove)) < 0) { return false; }
		destRow = (originRow - Math.abs(vertMove));
	}
	
	if(horizMove > 0)
	{
		if(originCol + horizMove > NUM_COLS - 1) { return false; }
		destCol = (originCol + horizMove);
	}
	
	if(horizMove < 0)
	{
		if((originCol - Math.abs(horizMove)) < 0) { return false; }
		destCol = (originCol - Math.abs(horizMove));
	}
	
	return(map[destRow] != null && map[destRow][destCol] != null);
}

app.use(express.static(__dirname + "/client/"));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/client/client.html');
});

server.on("listening", function()
{
	console.log("==========================");
	console.log("= HEX GAMESERVER STARTED =");
	console.log("==========================");
});

io.on('connection', function (socket) {
	let matchId;

	assignPlayerToMatch(socket.id, function(id) {
		matchId = id;
		let match = matches.get(matchId);
		socket.join(matchId);

		match.getUnclaimedHexes(true, function(initialHex) {
			var neighborsToInitialHex = match.getNeighbors(initialHex.row, initialHex.col).length;
			let initialUnitCount = Math.round(match.tick + (neighborsToInitialHex * 10));
			match.gameWorld[initialHex.row][initialHex.col].units = initialUnitCount;
			initialHex.units = initialUnitCount;
			
			match.changeHexOwner(initialHex.row, initialHex.col, socket.id);
			var visible = match.getVisibleWorld(socket.id);
			
			var initialData = 
			{
				playerId: socket.id,
				playerColor: match.players.get(socket.id).colorData.code,
				gameWorld: match.map,
				visibleWorld: visible,
				initialHex: initialHex
			};
			
			socket.emit("init", initialData);
		})
		socket.on("disconnect", function(data)
		{
			match.movementPool.forEach(function(move) {
				if(move.owner == socket.id)
				{
					move.destroy();
				}
			});

			match.leavePlayer(socket.id);
			if(matches.get(matchId).players.length == 0)
			{
				match.destroy();
				matches.set(matchId, null);
				matches.delete(matchId);
			}
		});
		
		socket.on("moveUnits", function(data)
		{
			match.moveUnits(socket.id, data.fromHex[0], data.fromHex[1], data.toHex[0], data.toHex[1], data.units);
		});
	});
});

server.listen(8000);