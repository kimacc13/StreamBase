'use client'

import { useState, useEffect } from 'react'
import { createWalletClient, createPublicClient, custom, http, parseEther, formatEther } from 'viem'
import { base } from 'viem/chains'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract'

declare global {
  interface Window {
    ethereum?: any
  }
}

type Tab = 'depositor' | 'recipient'

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('depositor')

  // Contract data
  const [contractBalance, setContractBalance] = useState<string>('0')
  const [totalEarned, setTotalEarned] = useState<string>('0')
  const [payers, setPayers] = useState<string[]>([])
  const [streamDetails, setStreamDetails] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  // Form states
  const [depositAmount, setDepositAmount] = useState('')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [txStatus, setTxStatus] = useState('')

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  })

  useEffect(() => {
    checkConnection()
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', () => window.location.reload())
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  useEffect(() => {
    if (account) {
      fetchData()
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [account])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const checkConnection = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts.length > 0) {
        setAccount(accounts[0])
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        setChainId(parseInt(chainId, 16))
      }
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAccount(accounts[0])
    } else {
      setAccount(null)
    }
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet')
      return
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      setAccount(accounts[0])

      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      const currentChainId = parseInt(chainId, 16)
      setChainId(currentChainId)

      if (currentChainId !== base.id) {
        await switchToBase()
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      alert('Failed to connect wallet')
    }
  }

  const switchToBase = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${base.id.toString(16)}` }],
      })
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${base.id.toString(16)}`,
            chainName: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        })
      }
    }
  }

  const disconnect = () => {
    setAccount(null)
    setChainId(null)
  }

  const fetchData = async () => {
    try {
      if (!account) return

      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getContractBalance',
      })
      setContractBalance(formatEther(balance as bigint))

      const payersList = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPayersForRecipient',
        args: [account as `0x${string}`],
      }) as string[]

      setPayers(payersList)

      if (payersList.length > 0) {
        const total = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getTotalEarned',
          args: [account as `0x${string}`],
        })
        setTotalEarned(formatEther(total as bigint))

        const streamPromises = payersList.map(payer =>
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getStream',
            args: [account as `0x${string}`, payer as `0x${string}`],
          })
        )
        const streams = await Promise.all(streamPromises)
        setStreamDetails(streams.map((s: any, i) => ({
          payer: payersList[i],
          salaryPerMonth: s[0],
          startTime: s[1],
          earned: s[2],
          active: s[3]
        })))
      } else {
        setTotalEarned('0')
        setStreamDetails([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleDeposit = async () => {
    if (!account || !depositAmount) return

    if (chainId !== base.id) {
      await switchToBase()
      return
    }

    try {
      setTxStatus('Waiting for confirmation...')

      const walletClient = createWalletClient({
        account: account as `0x${string}`,
        chain: base,
        transport: custom(window.ethereum),
      })

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      })

      setTxStatus('Transaction submitted!')
      await publicClient.waitForTransactionReceipt({ hash })
      setTxStatus('Deposit successful!')
      setDepositAmount('')
      await fetchData()
      setTimeout(() => setTxStatus(''), 3000)
    } catch (error: any) {
      console.error('Transaction error:', error)
      setTxStatus('Transaction failed: ' + (error.shortMessage || error.message))
      setTimeout(() => setTxStatus(''), 5000)
    }
  }

  const handleAddEmployee = async () => {
    if (!account || !employeeAddress || !salaryAmount) return

    try {
      setTxStatus('Waiting for confirmation...')

      const walletClient = createWalletClient({
        account: account as `0x${string}`,
        chain: base,
        transport: custom(window.ethereum),
      })

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createStream',
        args: [employeeAddress as `0x${string}`, parseEther(salaryAmount)],
      })

      setTxStatus('Transaction submitted!')
      await publicClient.waitForTransactionReceipt({ hash })
      setTxStatus('Stream created successfully!')
      setEmployeeAddress('')
      setSalaryAmount('')
      await fetchData()
      setTimeout(() => setTxStatus(''), 3000)
    } catch (error: any) {
      setTxStatus('Transaction failed: ' + (error.shortMessage || error.message))
      setTimeout(() => setTxStatus(''), 5000)
    }
  }

  const handleWithdrawSalary = async () => {
    if (!account) return

    try {
      setTxStatus('Waiting for confirmation...')

      const walletClient = createWalletClient({
        account: account as `0x${string}`,
        chain: base,
        transport: custom(window.ethereum),
      })

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'withdrawSalary',
      })

      setTxStatus('Transaction submitted!')
      await publicClient.waitForTransactionReceipt({ hash })
      setTxStatus('Salary withdrawn successfully!')
      await fetchData()
      setTimeout(() => setTxStatus(''), 3000)
    } catch (error: any) {
      setTxStatus('Transaction failed: ' + (error.shortMessage || error.message))
      setTimeout(() => setTxStatus(''), 5000)
    }
  }

  const handleWithdrawDeposit = async () => {
    if (!account || !withdrawAmount) return

    try {
      setTxStatus('Waiting for confirmation...')

      const walletClient = createWalletClient({
        account: account as `0x${string}`,
        chain: base,
        transport: custom(window.ethereum),
      })

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'withdrawDeposit',
        args: [parseEther(withdrawAmount)],
      })

      setTxStatus('Transaction submitted!')
      await publicClient.waitForTransactionReceipt({ hash })
      setTxStatus('Withdrawal successful!')
      setWithdrawAmount('')
      await fetchData()
      setTimeout(() => setTxStatus(''), 3000)
    } catch (error: any) {
      setTxStatus('Transaction failed: ' + (error.shortMessage || error.message))
      setTimeout(() => setTxStatus(''), 5000)
    }
  }

  const formatTimeRemaining = (startTime: bigint) => {
    const start = Number(startTime) * 1000
    const elapsed = currentTime - start
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h streaming`
    if (hours > 0) return `${hours}h ${minutes % 60}m streaming`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s streaming`
    return `${seconds}s streaming`
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>BaseStream</h1>

            {/* Tabs */}
            {account && (
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('depositor')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'depositor'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={activeTab === 'depositor' ? { backgroundColor: 'var(--accent)' } : {}}
                >
                  Depositor
                </button>
                <button
                  onClick={() => setActiveTab('recipient')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'recipient'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={activeTab === 'recipient' ? { backgroundColor: 'var(--accent)' } : {}}
                >
                  Recipient
                </button>
              </div>
            )}
          </div>

          {/* Connect Wallet Button */}
          {account ? (
            <button
              onClick={disconnect}
              className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              {account.slice(0, 6)}...{account.slice(-4)}
            </button>
          ) : (
            <button
              onClick={connectWallet}
              className="px-6 py-2 rounded-lg font-medium transition-all"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {!account ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Welcome to BaseStream
            </h2>
            <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>
              Stream salaries on Base blockchain in real-time
            </p>
            <button
              onClick={connectWallet}
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            >
              Connect Wallet to Start
            </button>
          </div>
        ) : (
          <>
            {/* Depositor Tab */}
            {activeTab === 'depositor' && (
              <div className="space-y-6">
                {/* Deposit Card */}
                <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Deposit Funds
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-4 py-3 rounded-lg text-2xl font-medium outline-none"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>ETH</span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          Contract Balance: {contractBalance} ETH
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleDeposit}
                      disabled={!depositAmount || !!txStatus}
                      className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                    >
                      Deposit
                    </button>
                  </div>
                </div>

                {/* Create Stream Card */}
                <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Create Salary Stream
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Recipient Address
                      </label>
                      <input
                        type="text"
                        value={employeeAddress}
                        onChange={(e) => setEmployeeAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-3 rounded-lg font-mono outline-none"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Monthly Salary (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={salaryAmount}
                        onChange={(e) => setSalaryAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-4 py-3 rounded-lg text-xl font-medium outline-none"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <button
                      onClick={handleAddEmployee}
                      disabled={!employeeAddress || !salaryAmount || !!txStatus}
                      className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                    >
                      Create Stream
                    </button>
                  </div>
                </div>

                {/* Withdraw Deposit Card */}
                <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Withdraw Unused Funds
                  </h3>
                  <div className="space-y-4">
                    <input
                      type="number"
                      step="0.001"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 rounded-lg text-xl font-medium outline-none"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                    <button
                      onClick={handleWithdrawDeposit}
                      disabled={!withdrawAmount || !!txStatus}
                      className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recipient Tab */}
            {activeTab === 'recipient' && (
              <div className="space-y-6">
                {streamDetails.length > 0 ? (
                  <>
                    {/* Total Earned Card */}
                    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                      <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Total Available to Withdraw
                      </div>
                      <div className="text-5xl font-bold mb-6" style={{ color: 'var(--accent)' }}>
                        {totalEarned} ETH
                      </div>
                      <button
                        onClick={handleWithdrawSalary}
                        disabled={!!txStatus || parseFloat(totalEarned) === 0}
                        className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                      >
                        Withdraw All
                      </button>
                    </div>

                    {/* Streams List */}
                    <div className="space-y-3">
                      {streamDetails.map((stream, index) => (
                        stream.active && (
                          <div
                            key={index}
                            className="rounded-xl p-4"
                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>From</div>
                                <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                                  {stream.payer.slice(0, 8)}...{stream.payer.slice(-6)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Monthly Rate</div>
                                <div className="font-semibold" style={{ color: 'var(--accent)' }}>
                                  {formatEther(stream.salaryPerMonth)} ETH
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <div>
                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Earned</div>
                                <div className="font-bold" style={{ color: 'var(--accent)' }}>
                                  {formatEther(stream.earned)} ETH
                                </div>
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                ⏱️ {formatTimeRemaining(stream.startTime)}
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="text-6xl mb-4">💰</div>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      No Incoming Streams
                    </h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      You don't have any active salary streams yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transaction Status */}
            {txStatus && (
              <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <p className="font-semibold" style={{ color: 'var(--accent)' }}>{txStatus}</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
