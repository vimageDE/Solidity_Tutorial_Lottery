const { ethers, network } = require('hardhat');
const { expect, assert } = require('chai');

describe('SimpleStorage', function () {
  let simpleStorageFactory;
  let contract;
  this.beforeEach(async function () {
    simpleStorageFactory = await ethers.getContractFactory('SimpleStorage');
    contract = await simpleStorageFactory.deploy();
  });

  it('Should start with a favorite number of 0', async function () {
    console.log('Network: ', network.name);

    const currentValue = await contract.retrieve();
    const expectedValue = '0';

    assert.equal(currentValue.toString(), expectedValue);
  });

  it('Should update when we call store', async function () {
    const expectedValue = '7';
    const transactionRepsonse = await contract.store(expectedValue);
    await transactionRepsonse.wait(1);

    const currentValue = await contract.retrieve();
    assert.equal(expectedValue, currentValue.toString());
  });

  it('Should add a person and their favorite number', async function () {
    const expectedValue = 7;
    const expectedName = 'Franz';
    const transactionResponse = await contract.addPerson(expectedName, expectedValue);
    await transactionResponse.wait(1);

    const currentPerson = await contract.people(0);
    const currentValue = (await contract.nameToFavoriteNumber(expectedName)).toNumber();

    assert.equal(expectedName, currentPerson.name);
    assert.equal(expectedValue, currentPerson.favoriteNumber.toNumber());
    assert.equal(currentValue, expectedValue);
  });
});
