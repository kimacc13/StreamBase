// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SalaryStreamV2 {
    struct Deposit {
        uint256 totalDeposited;
        uint256 allocated;
    }

    struct Stream {
        address payer;
        uint256 salaryPerSecond;
        uint256 startTime;
        uint256 lastWithdrawTime;
        bool active;
    }

    // depositor => Deposit info
    mapping(address => Deposit) public deposits;

    // recipient => payer => Stream info
    mapping(address => mapping(address => Stream)) public streams;

    // recipient => list of payers
    mapping(address => address[]) public recipientPayers;

    event Deposited(address indexed from, uint256 amount);
    event StreamCreated(address indexed payer, address indexed recipient, uint256 salaryPerMonth);
    event StreamStopped(address indexed payer, address indexed recipient);
    event SalaryWithdrawn(address indexed recipient, address indexed payer, uint256 amount);
    event DepositWithdrawn(address indexed depositor, uint256 amount);

    // Anyone can deposit funds
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        deposits[msg.sender].totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // Depositor creates a salary stream to a recipient
    function createStream(address _recipient, uint256 _salaryPerMonth) external {
        require(_recipient != address(0), "Invalid recipient");
        require(_recipient != msg.sender, "Cannot stream to yourself");
        require(!streams[_recipient][msg.sender].active, "Stream already exists");

        // Convert monthly salary to per-second rate
        uint256 salaryPerSecond = _salaryPerMonth / 2592000; // 30 days in seconds
        require(_salaryPerMonth > 0, "Salary must be greater than 0");

        // Check if depositor has enough balance
        uint256 available = deposits[msg.sender].totalDeposited - deposits[msg.sender].allocated;
        require(available >= _salaryPerMonth, "Insufficient balance");

        // Allocate funds
        deposits[msg.sender].allocated += _salaryPerMonth;

        // Create stream
        streams[_recipient][msg.sender] = Stream({
            payer: msg.sender,
            salaryPerSecond: salaryPerSecond,
            startTime: block.timestamp,
            lastWithdrawTime: block.timestamp,
            active: true
        });

        recipientPayers[_recipient].push(msg.sender);

        emit StreamCreated(msg.sender, _recipient, _salaryPerMonth);
    }

    // Depositor can stop their stream
    function stopStream(address _recipient) external {
        Stream storage stream = streams[_recipient][msg.sender];
        require(stream.active, "Stream not found");

        // Calculate and allow recipient to withdraw earned amount
        uint256 earned = getEarnedFromPayer(_recipient, msg.sender);

        // Free up remaining allocation
        uint256 monthlyAllocation = stream.salaryPerSecond * 2592000;
        deposits[msg.sender].allocated -= monthlyAllocation;

        stream.active = false;

        emit StreamStopped(msg.sender, _recipient);
    }

    // Calculate earned salary from a specific payer
    function getEarnedFromPayer(address _recipient, address _payer) public view returns (uint256) {
        Stream memory stream = streams[_recipient][_payer];
        if (!stream.active) return 0;

        uint256 timeWorked = block.timestamp - stream.lastWithdrawTime;
        return timeWorked * stream.salaryPerSecond;
    }

    // Get total earned salary from all payers
    function getTotalEarned(address _recipient) public view returns (uint256) {
        uint256 total = 0;
        address[] memory payers = recipientPayers[_recipient];

        for (uint256 i = 0; i < payers.length; i++) {
            total += getEarnedFromPayer(_recipient, payers[i]);
        }

        return total;
    }

    // Recipient withdraws earned salary from all streams
    function withdrawSalary() external {
        uint256 totalEarned = 0;
        address[] memory payers = recipientPayers[msg.sender];

        require(payers.length > 0, "No active streams");

        for (uint256 i = 0; i < payers.length; i++) {
            address payer = payers[i];
            Stream storage stream = streams[msg.sender][payer];

            if (stream.active) {
                uint256 earned = getEarnedFromPayer(msg.sender, payer);
                if (earned > 0) {
                    totalEarned += earned;
                    stream.lastWithdrawTime = block.timestamp;

                    // Reduce allocated amount
                    deposits[payer].allocated -= earned;
                }
            }
        }

        require(totalEarned > 0, "No salary to withdraw");
        require(address(this).balance >= totalEarned, "Insufficient contract balance");

        (bool success, ) = payable(msg.sender).call{value: totalEarned}("");
        require(success, "Transfer failed");

        emit SalaryWithdrawn(msg.sender, address(0), totalEarned);
    }

    // Depositor withdraws unused funds
    function withdrawDeposit(uint256 amount) external {
        uint256 available = deposits[msg.sender].totalDeposited - deposits[msg.sender].allocated;
        require(amount <= available, "Amount exceeds available balance");

        deposits[msg.sender].totalDeposited -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit DepositWithdrawn(msg.sender, amount);
    }

    // Get depositor's available balance
    function getAvailableBalance(address _depositor) external view returns (uint256) {
        return deposits[_depositor].totalDeposited - deposits[_depositor].allocated;
    }

    // Get contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Get stream info
    function getStream(address _recipient, address _payer) external view returns (
        uint256 salaryPerMonth,
        uint256 startTime,
        uint256 earned,
        bool active
    ) {
        Stream memory stream = streams[_recipient][_payer];
        return (
            stream.salaryPerSecond * 2592000,
            stream.startTime,
            getEarnedFromPayer(_recipient, _payer),
            stream.active
        );
    }

    // Get all payers for a recipient
    function getPayersForRecipient(address _recipient) external view returns (address[] memory) {
        return recipientPayers[_recipient];
    }

    receive() external payable {
        deposits[msg.sender].totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
