require('dotenv').config();
const { ethers, run, network } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with account:', deployer.address);
  const factory = await ethers.getContractFactory('SimpleStorage');

  // Deploy
  const contract = await factory.deploy();
  console.log('Contract address:', contract.address);
  await contract.deployed();
  console.log(`Deployed Contract to: ${contract.address}`);

  // Verify if published on Sepolia
  if (network.config.chainId === 11155111 && process.env.ETHERSCAN_TOKEN) {
    console.log('Waiting for block txes...');
    await contract.deployTransaction.wait(6);
    await verify(contract.address, []);
  }

  const currentValue = await contract.retrieve();
  console.log(`current Value is: ${currentValue}`);

  // Update current Value
  const transactionResponse = await contract.store(7);
  await transactionResponse.wait(1);
  const updatedValue = await contract.retrieve();
  console.log(`Updated Value is: ${updatedValue}`);
}

async function verify(contractAdress, args) {
  console.log('Verifiying contract...');
  try {
    await run('verify:verify', {
      address: contractAdress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes('already verified')) {
      console.log('Already Verified!');
    } else {
      console.log(e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
