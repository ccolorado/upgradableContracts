const Web3 = require('web3')

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const BigNumber = require('bignumber.js')

const Escrow = artifacts.require('Escrow.sol')

const EscrowContract = require(
  '../build/contracts/Escrow.json'
)

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

    this.escrow = await Escrow.new(this.addr.buyer, this.addr.seller)
    this.addr.escrow = this.escrow.address

    this.CEscrow = await new web3.eth.Contract(
      EscrowContract.abi, this.addr.escrow
    )

    // console.log("this.addr : ", this.addr)
    // console.log("this.balances : ", this.balances)

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

});
