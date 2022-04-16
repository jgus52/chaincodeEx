/*
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

const { Contract } = require("fabric-contract-api");

class ErcTwentyContract extends Contract {
    async init(ctx, tokenName, symbol, owner, amount) {
        console.log("init called");

        // check amount unsignedInt
        let amountInt = parseInt(amount);

        if (amountInt === NaN || amountInt < 0) {
            throw new Error(
                `amount must be number or amount could not be minus`
            );
        }
        if (tokenName.length == 0 || symbol.length == 0 || owner.length == 0) {
            throw new Error(`tokenNameor  symbol or owner cannot be empty`);
        }

        const asset = {
            Name: tokenName,
            Symbol: symbol,
            Owner: owner,
            Amount: amountInt,
        };

        await ctx.stub.putState(tokenName, JSON.stringify(asset));
        await ctx.stub.putState(owner, amount);
    }

    async totalSupply(ctx, tokenName) {
        const erc20JSON = await ctx.stub.getState(tokenName);
        if (!erc20JSON || erc20JSON.length === 0) {
            throw new Error(`The ${tokenName} does not exist`);
        }

        return erc20JSON.toString();
    }
    async balanceOf(ctx, owner) {
        const balanceJSON = await ctx.stub.getState(owner);
        if (!balanceJSON || balanceJSON.length === 0) {
            return "0";
        }

        return balanceJSON.toString();
    }
    async transfer(ctx, sender, receiver, amount) {
        let amountInt = parseInt(amount);

        if (amountInt === NaN || amountInt < 0) {
            throw new Error(
                `amount must be number or amount could not be minus`
            );
        }

        const senderBalanceJSON = await ctx.stub.getState(sender);
        if (!senderBalanceJSON || senderBalanceJSON.length === 0) {
            throw new Error(`The ${owner} does not exist`);
        }
        const senderBalance = parseInt(JSON.parse(senderBalanceJSON));
        if (amountInt > senderBalance) {
            throw new Error(`Cannot transfer: less blalnce`);
        }

        const receiverBalanceJson = await ctx.stub.getState(receiver);

        const receiverBalance =
            !receiverBalanceJson || receiverBalanceJson.length === 0
                ? 0
                : parseInt(JSON.parse(receiverBalanceJson));

        const senderResultAmount = senderBalance - amountInt;
        const receiverResultAmount = receiverBalance + amountInt;

        await ctx.stub.putState(sender, String(senderResultAmount));
        await ctx.stub.putState(receiver, String(receiverResultAmount));

        // const transferEvent = {
        //     Sender: sender,
        //     Receiver: receiver,
        //     Amount: amount,
        // };

        // let err = await ctx.stub.setEvent(
        //     "transferEvent",
        //     JSON.stringify(transferEvent)
        // );
        // if (!err) {
        //     throw new Error(`Event Error!`, err);
        // }
    }
    async allowance(ctx, owner, spender) {
        let approveKey = ctx.stub.createCompositeKey("approval", [
            owner,
            spender,
        ]);

        const amountJSON = await ctx.stub.getState(approveKey);
        // if (!amountJSON || amountJSON.length === 0) {
        //     return "0";
        // }

        return JSON.parse(amountJSON);
    }
    async approve(ctx, owner, spender, amount) {
        let allowanceAmountInt = parseInt(amount);
        if ((allowanceAmountInt === NaN) | (allowanceAmountInt <= 0)) {
            throw new Error(`amount should be positive number`);
        }

        let approveKey = await ctx.stub.createCompositeKey("approval", [
            owner,
            spender,
        ]);
        if (!approveKey) {
            throw new Error(`conpositeKey err`);
        }

        let putKey = await ctx.stub.putState(approveKey, amount);
        if (!putKey) {
            throw new Error(`putState approveKey err`);
        }
        // await ctx.stub.setEvent(
        //     "approvalEvent",
        //     JSON.stringify({ Spender: spender, Owner: owner, Amount: amount })
        // );
    }
    async approvalList(ctx, owner) {
        const list = [];

        let approvalIter = ctx.stub.getStateByPartialCompositeKeyWithPagination(
            "approval",
            [owner]
        );
        if (!approvalIter) {
            throw new Error(`getStateByPartialCompositeKeyWithPagination Err`);
        }

        for await (const approvalKV of approvalIter) {
            const { owner, spender } = await ctx.stub.splitCompositeKey(
                approvalKV.key
            );
            let amountJSON = approvalKV.value;
            let amountInt = parseInt(amountJSON);

            const approval = {
                Spender: spender,
                Owner: owner,
                Amount: amountInt,
            };
            list.push(approval);
        }

        return list;
    }
    async transferFrom(ctx, owner, spender, recipient, amount) {
        let amountInt = parseInt(amount);
        if ((amountInt === NaN) | (amountInt <= 0)) {
            throw new Error(`amount should be positive number`);
        }

        // get allowance
        let allowance = await this.allowance(ctx, owner, spender);
        allowance = parseInt(allowance);
        // convert allowance response to allowance data
        // const allowance = JSON.stringify(allowanceResponse);
        //transfer from owner to recipient
        await this.transfer(ctx, owner, recipient, amountInt);

        //reduce amount of allowance
        let approveAmountInt = allowance - amountInt;
        await this.approve(ctx, owner, spender, String(approveAmountInt));

        return true;
    }

    //transferOtherToken: moves amount other chaincode tokens
    // caller, recipient, amount
    async transferOtherToken(ctx, chaincode, caller, recipient, amount) {
        let args = [["transfer"], [caller], [recipient], [amount]];

        let channel = await ctx.stub.getChannelID();
        let invokeChaincodeRes = await ctx.stub.invokeChaincode(
            chaincode,
            args,
            channel
        );

        if (!invokeChaincodeRes) {
            throw new Error(`${chaincode} :   InvokeCHaincode Err!`);
        }
    }
    async increaseAllowance(ctx, owner, spender, amount) {
        let increaseAmountInt = parseInt(amount);
        if (increaseAmountInt == NaN || increaseAmountInt <= 0) {
            throw new Error(`amount should be positive number`);
        }

        let allowance = await this.allowance(ctx, owner, spender);
        allowance = parseInt(allowance);

        await this.approve(
            ctx,
            owner,
            spender,
            String(allowance + increaseAmountInt)
        );
    }
    async decreaseAllowance(ctx, owner, spender, amount) {
        let decreaseAmountInt = parseInt(amount);
        if (decreaseAmountInt == NaN || decreaseAmountInt <= 0) {
            throw new Error(`amount should be positive number`);
        }

        let allowance = await this.allowance(ctx, owner, spender);
        allowance = parseInt(allowance);

        if (decreaseAmountInt > allowance) {
            throw new Error(`Cannot decrease over allowance`);
        }

        await this.approve(
            ctx,
            owner,
            spender,
            String(allowance - decreaseAmountInt)
        );

        return true;
    }
    async mint(ctx) {
        return true;
    }
    async burn(ctx) {
        return true;
    }
}

module.exports = ErcTwentyContract;
