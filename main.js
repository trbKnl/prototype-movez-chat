const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { Combination } = require('js-combinatorics');
const { Worker, Queue } = require('bullmq')
const Redis = require('ioredis')

const crypto = require("crypto")
const randomId = () => crypto.randomBytes(8).toString("hex")

const { Game, GameStore } = require("./game.js")
let gameStore = new GameStore(new Redis())

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
    connection: new Redis({
      host: "0.0.0.0",
      port: 6379,
      maxRetriesPerRequest: null
  })
});


// GAMEQUEUE

const gameQueueWorker = new Worker('gameQueue', async (job) => {
  await gameLoop(job.data.players)
  }, { 
    connection: new Redis({
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
    let gameId = randomId()
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
      game.nextRound()
      await gameStore.save(gameId, game)
    }
    players.forEach((player) => {
      io.to(player).emit("game end")
    })
    console.log("END GAME")
  } catch (error) {
    console.log(error)
  }
}



