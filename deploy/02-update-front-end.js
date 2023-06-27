const { ethers, network } = require('hardhat');
const fs = require('fs');

const FRONT_END_ADDRESS_FILE = '../Solidity_Tutorial_Lottery_html/raffle-nextjs/constants/contractAddresses.json';
const FRONT_END_ABI_FILE = '../Solidity_Tutorial_Lottery_html/raffle-nextjs/constants/abi.json';

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log('Updating front end...');
    await updateContractAddress();
    await updateAbi();
  }
};

async function updateContractAddress() {
  const raffle = await ethers.getContract('Raffle');
  const chainId = network.config.chainId.toString();
  const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE, 'utf8'));
  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address);
    }
  } else {
    currentAddresses[chainId] = [raffle.address];
  }

  fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddresses));
}

async function updateAbi() {
  const raffle = await ethers.getContract('Raffle');
  fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json));
}

module.exports.tags = ['all', 'frontend'];
