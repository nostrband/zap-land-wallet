import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Text,
  VStack,
  InputGroup,
  InputRightAddon,
  Image,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  ButtonGroup,
  Center,
  Spinner,
} from '@chakra-ui/react'
import { CopyIcon } from '@chakra-ui/icons'
import { createWallet } from 'nwc-enclaved-utils'
import { nwc } from '@getalby/sdk'
import { QRCodeSVG } from 'qrcode.react'

// Custom QR code icon component
const QrCodeIcon = (props: any) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 24 24"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM13 21h2v2h-2zM21 13h2v2h-2zM21 21h2v2h-2zM21 17h2v2h-2z"/>
  </svg>
)

function App() {
  const [nwcString, setNwcString] = useState('')
  const [lnAddress, setLnAddress] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrContent, setQrContent] = useState('')
  const [qrTitle, setQrTitle] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [maxBalance, setMaxBalance] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [invoice, setInvoice] = useState('')
  const [paymentHash, setPaymentHash] = useState('')
  const [isDev, setIsDev] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let intervalId: number | undefined

    const fetchBalance = async () => {
      if (!nwcString) return
      
      try {
        setIsLoadingBalance(true)
        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcString })
        const response = await client.getBalance()
        if ('balance' in response) {
          setBalance(Number(response.balance) / 1000) // Convert millisats to sats
        }
      } catch (error) {
        console.error('Error fetching balance:', error)
        toast({
          title: 'Error fetching balance',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } finally {
        setIsLoadingBalance(false)
      }
    }

    if (nwcString) {
      fetchBalance()
      intervalId = window.setInterval(fetchBalance, 5000)
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [nwcString, toast])

  // Monitor for payment
  useEffect(() => {
    let intervalId: number | undefined

    const checkPayment = async () => {
      if (!nwcString || !paymentHash) return

      try {
        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcString })
        const { transactions } = await client.listTransactions({ limit: 1 })
        
        if (Array.isArray(transactions) && transactions.length > 0) {
          const lastTransaction = transactions[0]
          if (lastTransaction && 'payment_hash' in lastTransaction && lastTransaction.payment_hash === paymentHash) {
            setQrModalOpen(false)
            toast({
              title: 'Sats received',
              status: 'success',
              duration: 3000,
              isClosable: true,
            })
            // Clear the payment hash to stop monitoring
            setPaymentHash('')
          }
        }
      } catch (error) {
        console.error('Error checking payment:', error)
      }
    }

    if (paymentHash) {
      checkPayment()
      intervalId = window.setInterval(checkPayment, 5000)
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [nwcString, paymentHash, toast])

  const generateInvoice = async (connectionString: string) => {
    try {
      const client = new nwc.NWCClient({ nostrWalletConnectUrl: connectionString })
      const response = await client.makeInvoice({ amount: 10000 }) // 10000 millisats = 10 sats
      setInvoice(response.invoice)
      setPaymentHash(response.payment_hash)
    } catch (error) {
      console.error('Error generating invoice:', error)
      toast({
        title: 'Error generating invoice',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true)
      const { nwcString: newNwcString, lnAddress: newLnAddress, service } = await createWallet()
      setNwcString(newNwcString)
      setLnAddress(newLnAddress)
      if (service.maxBalance) {
        setMaxBalance(Number(service.maxBalance) / 1000) // Convert millisats to sats
      }
      // Check if service has enclave property
      if ('enclave' in service && typeof service.enclave === 'string') {
        setIsDev(service.enclave === "dev")
      }
      toast({
        title: 'Wallet created successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
      // Generate invoice with the new NWC string directly
      await generateInvoice(newNwcString)
    } catch (error) {
      toast({
        title: 'Error creating wallet',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
    })
  }

  const handleShowQR = (content: string, title: string) => {
    setQrContent(content)
    setQrTitle(title)
    setQrModalOpen(true)
  }

  return (
    <Center w="100%">
      <Container maxW="container.sm" py={8}>
        <VStack gap={6}>
          <Image
            src="/logo.svg"
            alt="Zap.land Logo"
            boxSize="100px"
          />
          
          <Heading size="lg" textAlign="center">
            Zap.land
          </Heading>
          
          <Text fontSize="lg" textAlign="center" color="gray.600">
            Create a lightning wallet with one click
          </Text>

          {!nwcString ? (
            <Button
              colorScheme="purple"
              size="lg"
              onClick={handleCreateWallet}
              width="full"
              maxW="300px"
              isLoading={isCreating}
              loadingText="Creating wallet..."
            >
              Create Wallet
            </Button>
          ) : (
            <>
              <Box textAlign="center" py={2}>
                {isDev && (
                  <Text fontSize="md" fontWeight="bold" color="red.500" mb={2}>
                    Developer instance, use at your own risk
                  </Text>
                )}
                <Text fontSize="lg" fontWeight="bold" color="gray.700">
                  Balance: {isLoadingBalance ? <Spinner size="xs" /> : balance === null ? '?' : `${balance} sats`}
                </Text>
                {maxBalance !== null && (
                  <Text fontSize="md" color="gray.600">
                    Maximum balance: {maxBalance} sats
                  </Text>
                )}
              </Box>

              <FormControl>
                <FormLabel mb={1}>NWC connection string:</FormLabel>
                <InputGroup size="md">
                  <Input
                    value={nwcString}
                    readOnly
                    placeholder="NWC connection string"
                  />
                  <InputRightAddon p={0} height="40px">
                    <ButtonGroup size="md" isAttached variant="ghost" spacing={0} height="100%">
                      <Button 
                        height="100%"
                        onClick={() => handleCopy(nwcString)}
                        _focus={{ boxShadow: 'none' }}
                        borderRight="1px solid"
                        borderColor="gray.200"
                      >
                        <CopyIcon />
                      </Button>
                      <Button 
                        height="100%"
                        onClick={() => handleShowQR(nwcString, 'NWC Connection String')}
                        _focus={{ boxShadow: 'none' }}
                      >
                        <QrCodeIcon />
                      </Button>
                    </ButtonGroup>
                  </InputRightAddon>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel mb={1}>Lightning address:</FormLabel>
                <InputGroup size="md">
                  <Input
                    value={lnAddress}
                    readOnly
                    placeholder="Lightning address"
                  />
                  <InputRightAddon p={0} height="40px">
                    <ButtonGroup size="md" isAttached variant="ghost" spacing={0} height="100%">
                      <Button 
                        height="100%"
                        onClick={() => handleCopy(lnAddress)}
                        _focus={{ boxShadow: 'none' }}
                        borderRight="1px solid"
                        borderColor="gray.200"
                      >
                        <CopyIcon />
                      </Button>
                      <Button 
                        height="100%"
                        onClick={() => handleShowQR(lnAddress, 'Lightning Address')}
                        _focus={{ boxShadow: 'none' }}
                      >
                        <QrCodeIcon />
                      </Button>
                    </ButtonGroup>
                  </InputRightAddon>
                </InputGroup>
              </FormControl>

              {invoice && (
                <FormControl>
                  <FormLabel mb={1}>Invoice to topup for 10 sats:</FormLabel>
                  <InputGroup size="md">
                    <Input
                      value={invoice}
                      readOnly
                      placeholder="Lightning invoice"
                    />
                    <InputRightAddon p={0} height="40px">
                      <ButtonGroup size="md" isAttached variant="ghost" spacing={0} height="100%">
                        <Button 
                          height="100%"
                          onClick={() => handleCopy(invoice)}
                          _focus={{ boxShadow: 'none' }}
                          borderRight="1px solid"
                          borderColor="gray.200"
                        >
                          <CopyIcon />
                        </Button>
                        <Button 
                          height="100%"
                          onClick={() => handleShowQR(invoice, 'Invoice for 10 sats')}
                          _focus={{ boxShadow: 'none' }}
                        >
                          <QrCodeIcon />
                        </Button>
                      </ButtonGroup>
                    </InputRightAddon>
                  </InputGroup>
                </FormControl>
              )}

              <Text fontSize="sm" color="gray.600" textAlign="center">
                Your wallet has been created! You can now:
                <VStack mt={2} spacing={1} align="start">
                  <Text>1. Use the NWC string with wallets like <a href="https://albygo.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#805AD5', textDecoration: 'underline' }}>Alby Go</a> to manage your sats.</Text>
                  <Text>2. Add the NWC string to <a href="https://damus.io/" target="_blank" rel="noopener noreferrer" style={{ color: '#805AD5', textDecoration: 'underline' }}>Damus</a> or <a href="https://www.amethyst.social/" target="_blank" rel="noopener noreferrer" style={{ color: '#805AD5', textDecoration: 'underline' }}>Amethyst</a> Nostr apps to send zaps.</Text>
                  <Text>3. Use your Lightning address to your Nostr profile to receive Zaps.</Text>
                </VStack>
              </Text>

              <Text fontSize="sm" color="red.500" fontWeight="bold" textAlign="center" mt={4}>
                Important: save your NWC string, it's the only way to access your wallet.
              </Text>
            </>
          )}
        </VStack>

        <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{qrTitle}</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Box display="flex" justifyContent="center" p={4}>
                <QRCodeSVG
                  value={qrContent}
                  size={256}
                  level="H"
                  includeMargin
                />
              </Box>
            </ModalBody>
          </ModalContent>
        </Modal>

        <Text fontSize="sm" color="gray.500" textAlign="center" mt={8} mb={4}>
        <a href="https://github.com/nostrband/zap-land-wallet/" target="_blank" rel="noopener noreferrer" style={{ color: '#805AD5', textDecoration: 'underline' }}>Open-source</a> example app built on <a href="https://github.com/nostrband/nwc-enclaved/" target="_blank" rel="noopener noreferrer" style={{ color: '#805AD5', textDecoration: 'underline' }}>nwc-enclaved</a> wallet.
        
        </Text>
      </Container>
    </Center>
  )
}

export default App
