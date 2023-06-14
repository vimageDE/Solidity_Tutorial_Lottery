const { network, ethers } = require('hardhat');

const BASE_FEE = ethers.utils.parseEther('0.25');
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const [deployer] = await ethers.getSigners();
  const localDeploy = network.config.local;
  if (localDeploy) {
    log('Local network detected! Deploying mocks...');
    // deploy a mock vrfcoordinator...
    await deploy('VRFCoordinatorV2Mock', {
      from: deployer.address,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK],
    });
    log('Mocks Deployed');
    log('---------------------------------------');
  }
};

module.exports.tags = ['all', 'mocks'];
