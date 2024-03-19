const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { Combination } = require('js-combinatorics');
const { Worker, Queue } = require('bullmq')
const IORedis = require('ioredis')

const crypto = require("crypto")
const randomId = () => crypto.randomBytes(8).toString("hex")

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let counter = 0

// Socket.IO connection handler
io.on('connection', async (socket) => {
  // Counter logic
  counter += 1
  console.log(`User: ${counter} connected`)
  // Generate random id and join the socket to a channel
  const id = randomId()
  socket.join(id)

  // welcome new client
  socket.emit("hello", `hello client ${id}`)

  // GAME LOGIC
  // add client to waiting list queue
  await waitingQueue.add("participant", {id: id});
  console.log(`added to queue ${id}`)

  socket.on('game started', () => {
    // register game on socket
    // so upon reconnect user can load the waitingQueue
  });

  // CHAT LOGIC
  // send chat message to peer
  socket.on('chat message', ({content, to}) => {
    console.log(`from: ${id}, to: ${to} message: ${content}`)
    socket.to(to).emit("chat message", content)
  });

  // SOCKET IO LOGIC
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



// QUEUES
// Create a new queue
//
async function emptyQueue(queue) {
  await queue.obliterate({ force: true });
  console.log('Queue emptied');
}

const gameQueue = new Queue('gameQueue');
const waitingQueue = new Queue('waitingQueue');
emptyQueue(waitingQueue)
emptyQueue(gameQueue)



// WAITING QUEUE

let players = []

// works because concurrency level is 1
const waitingQueueWorker = new Worker('waitingQueue', async (job) => {
    if (job.data.id !== undefined) {
      players.push(job.data.id)
    }
    if (players.length ===  4) {
      await gameQueue.add("game", {players: players});
      players.length = 0
    }
  }, { 
    connection: new IORedis({
      host: "0.0.0.0",
      port: 6379,
      maxRetriesPerRequest: null
  })
});


// GAMEQUEUE

const gameQueueWorker = new Worker('gameQueue', async (job) => {
  await gameLoop(job.data.players)
  }, { 
    connection: new IORedis({
      host: "0.0.0.0",
      port: 6379,
      maxRetriesPerRequest: null
    }),
    concurrency: 50 
  }
);



// GAMELOGIC

async function gameLoop(players) {
  /**
 * @param  {Array} players [should be length 4 containing player id's]
 */
  if (players.length !== 4) { throw new Error('A game should have exactly 4 players.') }

  try { // needed for development else you wont see any error messages
    // GAME LOGIC
    let gameOngoing = true

    console.log("START GAME")
    console.log(`These are the playersInGame ${players}`)

    // notify playersInGame that the game will start 
    players.forEach((player) => {
      io.to(player).emit("game start", player)
    })

    // create a game
    let game  = new Game(players)
    game.startGame()

    while (game.gameOngoing) {
      // get the first round
      let round = game.getRound()
      console.log(round)

      // communicate partners to player
      players.forEach((player) => {
        for (const pair of round) {
          if (pair.includes(player)) {
            const partner = pair.find(id => id !== player);
            io.to(player).emit("partner", partner)
          }
        }
      })
      await sleep(game.duration)
      console.log("Next round")
      game.nextRound()
    }
    players.forEach((player) => {
      io.to(player).emit("game end")
    })
    console.log("END GAME")
  } catch (error) {
    console.log(error)
  }
}



// GAME OBJECT

class Game {
  constructor(players) {
    if (players.length !== 4) {
      throw new Error('A game should have exactly 4 players.');
    }
    this.players = players;
    // divide players into rounds
    let combinations = new Combination(players, 2);
    this.combinations = [...combinations]
    this.roundOrder = [[0, 5], [1, 4], [2, 3]]
    this.currentRound = -1
    this.gameOngoing = false
    this.imposter = players[Math.floor(Math.random() * players.length)];
    this.duration = 5000
  }

  startGame() {
    if (this.currentRound !== -1){
      throw new Error("Game has already started")
    }
    this.gameOngoing = true
    this.currentRound += 1
  }

  endGame() {
    this.gameOngoing = false
  }

  nextRound() {
    if (this.gameOngoing) {
      this.currentRound += 1
      if (this.currentRound >= this.roundOrder.length) {
        this.endGame()
      }
    }
  }

  getRound() {
    if (this.gameOngoing) {
      let pairs = this.roundOrder[this.currentRound]
      return [this.combinations[pairs[0]], this.combinations[pairs[1]]]
    }
  }
}

