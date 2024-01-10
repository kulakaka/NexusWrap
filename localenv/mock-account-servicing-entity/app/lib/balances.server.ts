import { mockAccounts } from './accounts.server'

export type AccountWithBalance = {
  id: string
  name: string
  walletAddressID: string
  walletAddress: string
  balance: string
  assetCode: string
  assetScale: number
}

export async function getAccountsWithBalance(): Promise<
  Array<AccountWithBalance>
> {
  const accounts = await mockAccounts.listAll()
  return accounts.map((acc) => {
    return {
      id: acc.id,
      name: acc.name,
      walletAddressID: acc.walletAddressID,
      walletAddress: acc.walletAddress,
      balance: (
        BigInt(acc.creditsPosted) - BigInt(acc.debitsPosted)
      ).toString(),
      assetCode: acc.assetCode,
      assetScale: acc.assetScale
    }
  })
}
