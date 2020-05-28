const Web3 = require('web3')

const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
ZWeb3.initialize(web3.currentProvider);

const BigNumber = require('bignumber.js')

// const SmarterEscrowV0 = artifacts.require('SmarterEscrowV0.sol')

// const EscrowContract = require(
//   '../build/contracts/SmarterEscrowV0.json'
// )

const SmarterEscrow_V0 = Contracts.getFromLocal('SmarterEscrowV0')
const SmarterEscrow_V1 = Contracts.getFromLocal('SmarterEscrowV1')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

contract('Escrow Contract ', function (accounts) {

  beforeEach(async function () {
    this.addr = {}
    this.balances = {}
    this.addr.owner = accounts[0]
    this.addr.buyer = accounts[1]
    this.addr.seller = accounts[2]

    this.balances.owner = await web3.eth.getBalance(this.addr.owner);
    this.balances.buyer = await web3.eth.getBalance(this.addr.buyer);
    this.balances.seller = await web3.eth.getBalance(this.addr.seller);

    this.project = await TestHelper();

    this.CEscrow = await this.project.createProxy(
      SmarterEscrow_V0,
      {
        initArgs: [this.addr.buyer, this.addr.seller]
      }
    )

    this.addr.v0 = this.CEscrow.address
  });

  describe('Escrow mechanism', async function () {

    beforeEach(async function () {

      await this.CEscrow.methods.deposit().send({
        from: this.addr.buyer,
        value: web3.utils.toWei("1", "ether")
      }).should.be.fulfilled

    })

    it('Ether is deducted from buyer', async function () {

      const newBalance =  await web3.eth.getBalance(this.addr.buyer)
      const balanceDifference = BigNumber(this.balances.buyer).minus(newBalance)

      // console.log("balanceDifference : ", web3.utils.fromWei(balanceDifference.toString(), "ether"))

      balanceDifference.should.be.bignumber.above(web3.utils.toWei("1", "ether"))
      balanceDifference.should.be.bignumber.below(web3.utils.toWei("1.001", "ether"))

    })

    it('increase balance of the seller', async function () {

      await this.CEscrow.methods.confirmDelivery().send({
        from: this.addr.buyer,
      }).should.be.fulfilled

      const newBalance =  await web3.eth.getBalance(this.addr.seller)
      const balanceDifference = BigNumber(newBalance).minus(this.balances.seller)

      // console.log("balanceDifference : ", web3.utils.fromWei(balanceDifference.toString(), "ether"))

      balanceDifference.should.be.bignumber.equal(web3.utils.toWei("1", "ether"))

    })

  })

  describe('Escrow validations', async function () {

    it('prevent depositing twice', async function () {

      await this.CEscrow.methods.deposit().send({
        from: this.addr.buyer,
        value: web3.utils.toWei("1", "ether")
      }).should.be.fulfilled

      await this.CEscrow.methods.deposit().send({
        from: this.addr.buyer,
      }).should.be.rejectedWith(
        Error,
        "Already paid"
      )

    })

    it('not allow deposits from owner', async function () {

      await this.CEscrow.methods.deposit().send({
        from: this.addr.owner,
        value: web3.utils.toWei("1", "ether")
      }).should.be.rejectedWith(
        Error,
        "Only buyer can call this method"
      )

    })


    it('not allow confirmDelivery from owner', async function () {

      await this.CEscrow.methods.confirmDelivery().send({
        from: this.addr.owner,
      }).should.be.rejectedWith(
        Error,
        "Only buyer can call this method"
      )

    })

  })

  describe('Integrity Check', async function () {

    it('should not recognize ejectFunds function', async function () {

      try {
        await this.CEscrow.methods.ejectFunds().send({
          from: this.addr.owner
        })
      } catch (e) {

        const hasTypeError = e.toString().includes("TypeError: this.CEscrow.methods.ejectFunds")
        assert(hasTypeError, "Error is unrelated to ejectFunds not being a function")
      }

    })

  });


  describe('upgraded contract', async function () {

    beforeEach(async function () {

      await this.CEscrow.methods.deposit().send({
        from: this.addr.buyer,
        value: web3.utils.toWei("1", "ether")
      }).should.be.fulfilled

      this.oldBalance  = await web3.eth.getBalance(this.addr.v0);

      this.CEscrowUpgraded = await this.project.upgradeProxy(
        this.CEscrow.address,
        SmarterEscrow_V1
      );

    })

    it('preserves contract address', async function () {
      this.CEscrowUpgraded.address.should.be.equal(this.CEscrow.address)
    })

    it('preserves state', async function () {

      const _newBuyer = await this.CEscrowUpgraded.methods.buyer().call()
      const _newSeller = await this.CEscrowUpgraded.methods.seller().call()

      _newBuyer.should.be.equal(this.addr.buyer)
      _newSeller.should.be.equal(this.addr.seller)

    })

    it('preserves funds', async function () {
      const _newBalance = await web3.eth.getBalance(this.CEscrowUpgraded.address);
      _newBalance.should.be.equal(this.oldBalance)
    })

    it('can eject funds', async function () {

      const _startBalance =  await web3.eth.getBalance(this.addr.buyer);

      await this.CEscrowUpgraded.methods.ejectFunds().send({
        from: this.addr.seller,
      }).should.be.fulfilled

      const _endBalance = await web3.eth.getBalance(this.addr.buyer);

      const balanceDifference = BigNumber(_endBalance).minus(_startBalance);

      // console.log("_startBalance : ", web3.utils.fromWei(_startBalance.toString(), "ether"))
      // console.log("_endBalance : ", web3.utils.fromWei(_endBalance.toString(), "ether"))
      // console.log("balanceDifference : ", balanceDifference)

      _startBalance.should.be.bignumber.below(_endBalance)
      balanceDifference.should.be.bignumber.equal(1000000000000000000)
    })

  })


});
