const { network, ethers, deployments } = require('hardhat');
const { assert, expect } = require('chai');
const { equal } = require('assert');

!network.config.local
  ? describe.skip
  : describe('Raffle Unit Test', function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval;
      let deployer, player;
      this.beforeEach(async function () {
        [deployer] = await ethers.getSigners();
        await deployments.fixture('all');
        raffle = await ethers.getContract('Raffle', deployer);
        vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe('constructor', function () {
        it('initializes the raffle correctly', async function () {
          const raffleState = await raffle.getRaffleState();

          assert.equal(raffleState.toString(), '0');
          assert.equal(interval.toString(), network.config.interval);
          assert.equal(raffleEntranceFee, ethers.utils.parseEther('0.01').toString());
        });
      });

      describe('enterRaffle', function () {
        it('Reverts if you do not pay enough', async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, 'Raffle__NotEnoughEthEntered');
        });
        it('records players, when they enter', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const rafflePlayer = await raffle.getPlayer(0);
          assert.equal(rafflePlayer, deployer.address);
        });
        it('emits event on enter', async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, 'RaffleEnter');
        });
        it('doesnt allow entrance when raffle is calculating', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);
          // Pretend to be chainlink keeper
          await raffle.performUpkeep([]);
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(
            raffle,
            'Raffle__NotOpen'
          );
        });
      });

      describe('checkUpkeep', function () {
        it('returns false if people have not sent any ETH', async function () {
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });
        it('returns false if raffle is not open', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });

          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);

          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), '1');
          assert.equal(upkeepNeeded, false);
        });
        it('returns false if not enough time has passed', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const raffleState = await raffle.getRaffleState();

          await network.provider.send('evm_increaseTime', [interval.toNumber() - 5]);
          await network.provider.send('evm_mine', []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), '0');
          assert.equal(upkeepNeeded, false);
        });
        it('returns true if enough time has passed, has players, eth and is open', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);

          assert.equal(upkeepNeeded, true);
        });
      });

      describe('performUpkeep', function () {
        it('revert if checkUpkeep is false', async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWithCustomError(raffle, 'Raffle_UpkeeNotNeeded');
        });
        it('returns true if checkUpkeep is true', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);

          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });
        it('Calls the vrf coordinator', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);
          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          assert(requestId.toNumber() > 0);
        });
        it('raffleState set to calculating', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);

          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), '1');
        });
        it('emits event RequestedRaffleWinner', async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);

          await expect(raffle.performUpkeep([])).to.emit(raffle, 'RequestedRaffleWinner');
        });
      });

      describe('fulfillRandomWords', function () {
        this.beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [interval.toNumber() + 1]);
          await network.provider.send('evm_mine', []);
        });
        it('can only be called after performUpkeep', async function () {
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith(
            'nonexistent request'
          );
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith(
            'nonexistent request'
          );
        });
        it('picks a winner, resets the lottery and send money', async function () {
          const additionalEntrants = 3;
          const startingAccountIndex = 1;
          const accounts = await ethers.getSigners();
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
            const accountConnectedRaffle = raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLatestTimeStamp();

          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('Found the WinnerPicked Event!');
              try {
                const recentWinner = await raffle.getRecentWinner();

                console.log('Recentwinner: ', recentWinner);
                console.log('Players: ', accounts[0].address);
                console.log('Players: ', accounts[1].address);
                console.log('Players: ', accounts[2].address);
                console.log('Players: ', accounts[3].address);

                const raffleState = await raffle.getRaffleState();
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                const numPlayers = await raffle.getNumberOfPlayers();
                const winnerEndingBalance = await accounts[1].getBalance();
                const accountBalance = await assert.equal(numPlayers.toString(), '0');
                assert.equal(raffleState.toString(), '0');
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(
                  winnerEndingBalance,
                  winnerStartingBalance.add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee)).toString()
                );
              } catch (e) {
                reject(e);
              }
              resolve();
            });
            const tx = await raffle.performUpkeep([]);
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await accounts[1].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
          });
        });
      });
    });
