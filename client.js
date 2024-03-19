const io =  require("socket.io-client")

const URL = "http://localhost:3000"
const socket = io(URL, { autoConnect: false });

let chatPartnerId = 1
let playerId = 1
let gameOngoing = false
let receivedMessage = false

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt() {
  min = Math.ceil(1000);
  max = Math.floor(3000);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}



// socket io 
socket.on("hello", (msg) => {console.log(msg)})
socket.on("game start", (id) => {
  console.log(`GAME START FOR ${id}`)
  playerId = id
  gameOngoing = true
})

socket.on("game end", () => {
  console.log("GAME HAS ENDED")
  if (!receivedMessage) {
    console.log(`${playerId} HAS NOT REVEICED A MESSAGE` )
  }
  process.exit()
})

socket.on("partner", (partnerid) => {
  console.log(`Partner id received ${partnerid}`)
  chatPartnerId = partnerid
})

socket.on("chat message", (content) => {
  console.log(`chat message received ${content}`)
  receivedMessage = true
})
socket.connect()


// Fake a Chat loop 
async function asyncEventLoop() {
  while (true) {
    if (gameOngoing && chatPartnerId !== 1 ) {
      console.log(`IN A GAME: Player id: ${playerId}, PartnerId: ${chatPartnerId}`)
      socket.emit("chat message", {
          to: chatPartnerId,
          content: "Asd"
      })
      await sleep(getRandomInt())
    } else {
      console.log(`NOT IN A GAME: Player id: ${playerId}, PartnerId: ${chatPartnerId}`)
    }
    await sleep(1000)
  }
}

asyncEventLoop()

setInterval(() => {}, 1 << 30);
