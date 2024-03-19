const { Combination } = require('js-combinatorics');
const { unpack, pack } = require('msgpackr')

// GAME OBJECT

class Game {
  constructor(
    players = players,
    combinations = null,
    imposter = null
  ) {
    if (players.length !== 4) {
      throw new Error('A game should have exactly 4 players.');
    }
    if (combinations === null) {
      let playerCombinations = new Combination(players, 2);
      this.combinations = [...playerCombinations]
    } else {
      this.combinations = combinations
    }
    if (imposter === null) {
      this.imposter = players[Math.floor(Math.random() * players.length)];
    } else {
      this.imposter = imposter
    }
    this.players = players;
    this.roundOrder = [[0, 5], [1, 4], [2, 3]]
    this.currentRound = -1
    this.gameOngoing = false
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

  static createFromObject(game) {
    const {players, combinations, imposter} = game
    return new Game(players, combinations, imposter)
  }
}


const SESSION_TTL = 24 * 60 * 60;
//const Redis = require("ioredis")
//let redisClient = new Redis()


class GameStore {
  constructor(redisClient) {
    this.redisClient = redisClient;
  }

  async load(id) {
    let game = await this.redisClient.hgetBuffer(`game:${id}`, "game")
    if (game !== null) {
      let gameObject = unpack(game)
      game = Game.createFromObject(gameObject)
    }
    return game
  }

  async save(id, game) {
    await this.redisClient.multi().hset(
        `game:${id}`,
        "game",
        pack(game),
      )
      .expire(`game:${id}`, SESSION_TTL)
      .exec();
  }
}

module.exports = {
    GameStore,
    Game
};


//new Game(["a", "b", "c", "d"])
//
//
//var asd = new Game(["a", "b", "c", "d"])
//
//let store = new GameStore(redisClient)
//await store.save(1, asd)
//var check = await store.load(1)
//check
//
//var check = await store.load(2)
//check
//
//var test = Game.createFromObject(asd)
//test
//test.nextRound()
//test.startGame()
//test.nextRound()
//test.getRound()
//
//console.log(pack(asd))
//unpack(pack(asd))
//
//
