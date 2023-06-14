const { network, ethers, deployments } = require('hardhat');
const { assert, expect } = require('chai');
const { equal } = require('assert');

network.config.local
  ? describe.skip
  : describe('Raffle Unit Test', function () {
      let raffle, raffleEntranceFee, interval;
      let deployer;
      this.beforeEach(async function () {
        [deployer] = await ethers.getSigners();
        raffle = await ethers.getContract('Raffle', deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
      });
      describe('fulfillRandomWords', function () {
        it('works with live Chainlink Keepers and Chainlink VRF, we get a random winner', async function () {
          const startingTimeStamp = await raffle.getLatestTimeStamp();
          const accounts = await ethers.getSigners();

          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('WinnerPicked event fired!');
              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimeStamp = await raffle.getLatestTimeStamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState.toString(), '0');
                assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString());
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (error) {
                console.log(error);
                reject(e);
              }
            });

            await raffle.enterRaffle({ value: raffleEntranceFee });
            const winnerStartingBalance = await acounts[0].getBalance();
          });
        });
      });
    });
