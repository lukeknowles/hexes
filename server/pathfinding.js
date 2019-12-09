// pathfinding.js
// ==============
var PriorityQueue = require("./priorityqueue");

module.exports = {
    hexPositionChecksum: function(row, col) {
        return((1/2)*(row+col)*(row+col+1)+col);
    },

    getCubeCoordinates: function(col, row) {
        return({
            x: col,
            z: row - (col - (col&1)) / 2,
            y: -(col)-(row - (col - (col&1)) / 2)
        });
    },

    moveCost: function(origin, destination)
    {
        let originCoords = this.getCubeCoordinates(origin.col, origin.row);
        let destinationCoords = this.getCubeCoordinates(destination.col, destination.row);

        return(Math.max(Math.abs(originCoords.x - destinationCoords.x), Math.abs(originCoords.y - destinationCoords.y), Math.abs(originCoords.z - destinationCoords.z)));
    },

    rebuildPath: function(current, cameFrom)
    {
        let finalPath = [];
        finalPath.push(current);

        while(cameFrom[current] != null)
        {
            current = cameFrom[current];
            finalPath.push(current);
        }

        return finalPath.reverse();
    }
}