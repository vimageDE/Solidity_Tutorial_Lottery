const { network, ethers } = require('hardhat');
const { verify } = require('../Utils/verify');
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther('30');

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const [deployer] = await ethers.getSigners();
  let vrfCoordinatorV2Address, subscriptionId;
  const localChain = network.config.local;

  if (localChain) {
    const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = network.config.vrfCoordinatorV2;
    subscriptionId = network.config.subscriptionId;
  }

  const entranceFee = ethers.utils.parseEther('0.005'); // network.config.entranceFee;
  const gasLane = network.config.gasLane;
  const callbackGasLimit = network.config.callbackGasLimit;
  const interval = network.config.interval;
  const waitBlockConfirmations = network.config.blockConfirmations || 1;

  log('vrfCoordinatorV2Address: ', vrfCoordinatorV2Address);
  log('entranceFee: ', entranceFee.toString());
  log('gasLane: ', gasLane);
  log('subscriptionId: ', subscriptionId.toString());
  log('callbackGasLimit: ', callbackGasLimit);
  log('interval: ', interval);

  const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
  const raffle = await deploy('Raffle', {
    from: deployer.address,
    args: args,
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
  if (localChain) {
    const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
  }

  if (!localChain && process.env.ETHERSCAN_TOKEN) {
    log('Verifying...');
    await verify(raffle.address, args);
  }
  log('------------------------------');
};

module.exports.tags = ['all', 'raffle'];
