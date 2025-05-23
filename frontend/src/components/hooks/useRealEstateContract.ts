"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import {useWriteContract, useWaitForTransactionReceipt, useConfig,} from "wagmi";
import { readContract } from "@wagmi/core";
import { type Address, type Hex } from "viem";

import RealEstateERC721ABI from "../abis/RealEstateERC721.abi.json";
import { CONTRACT_ADDRESSES } from "../../config/index.ts";

export interface PropertyDetails {
  tokenId: bigint
  owner: string | null
  metadata: {
    name: string
    description: string
    image: string
  }
  cadastralNumber: string
  location: string
  valuation: bigint
  status: 'active' | 'inactive'
  active: boolean
  lastUpdated: bigint
  metadataURI: string
}
export interface UseRealEstateContractReturn {
  contractAddress?: Address; isLoading: boolean; isReading: boolean;
  isConfirming: boolean; isConfirmed: boolean; error: string | null;
  txHash?: Hex; receipt?: any;
  getPropertyDetails: (tokenId: bigint) => Promise<PropertyDetails | null>;
  getBalanceOf: (owner: Address) => Promise<bigint | null>;
  getOwnerOf: (tokenId: bigint) => Promise<Address | null>;
  getTokenURI: (tokenId: bigint) => Promise<string | null>;
  getAllTokenIds: () => Promise<readonly bigint[] | null>;
  isAdministrator: (addr: Address) => Promise<boolean | null>;
  mintProperty: (
    to: Address, cadastralNumber: string, location: string,
    valuation: bigint, metadataURI: string,
    callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }
  ) => Promise<Hex | null>;
  updatePropertyValuation: (
    tokenId: bigint, newValuation: bigint,
    callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }
  ) => Promise<void>;
  transferToken: (
    from: Address, to: Address, tokenId: bigint,
    callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }
  ) => Promise<void>;
}

export function useRealEstateContract(): any {
  const { address: account, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const wagmiConfig = useConfig();

  const [isReading, setIsReading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<Hex | undefined>(undefined);

  const contractAddress: Address | undefined = useMemo(() => {
      if (!chainId) return undefined;
      const chainContracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
      return chainContracts?.realEstateERC721;
  }, [chainId]);

  const {
    data: submittedTxHash, isPending: isTxPending, error: writeError,
    writeContractAsync, reset: resetWriteContract,
  } = useWriteContract();

  useEffect(() => {
    if (submittedTxHash) { setLastTxHash(submittedTxHash); setInternalError(null); }
  }, [submittedTxHash]);

  const {
    data: receipt, isLoading: isConfirming, isSuccess: isTxConfirmed,
    error: receiptError, status: receiptStatus,
  } = useWaitForTransactionReceipt({ hash: lastTxHash });

  const isLoading = isTxPending || isConfirming;
  const error = internalError ?? (receiptError?.message || writeError?.message || null);
  const isConfirmed = isTxConfirmed && receiptStatus === 'success';

  useEffect(() => {
    setInternalError(null); resetWriteContract(); setLastTxHash(undefined);
  }, [account, chainId, resetWriteContract]);

  const readWrapper = useCallback( /* ... as before ... */
    async <T>(functionName: string, args: any[] = []): Promise<T | null> => {
        if (!isConnected) { setInternalError("Wallet not connected."); return null; }
        if (!wagmiConfig) { setInternalError("Wagmi config not available."); return null; }
        if (!contractAddress) { setInternalError("RealEstate contract address not found for this chain."); return null; }
        setIsReading(true); setInternalError(null);
        try {
            const data = await readContract(wagmiConfig, { address: contractAddress, abi: RealEstateERC721ABI, functionName, args: args as any[] });
            return data as T;
        } catch (err: any) { console.error(`Error reading ${functionName}:`, err); setInternalError(err.shortMessage || err.message || `Failed to fetch ${functionName}`); return null; }
        finally { setIsReading(false); }
    }, [contractAddress, isConnected, wagmiConfig]
  );

  const getPropertyDetails = useCallback((tokenId: bigint) => readWrapper<PropertyDetails>("getPropertyDetails", [tokenId]), [readWrapper]);
  const getBalanceOf = useCallback((owner: Address) => readWrapper<bigint>("balanceOf", [owner]), [readWrapper]);
  const getOwnerOf = useCallback((tokenId: bigint) => readWrapper<Address>("ownerOf", [tokenId]), [readWrapper]);
  const getTokenURI = useCallback((tokenId: bigint) => readWrapper<string>("tokenURI", [tokenId]), [readWrapper]);
  const getAllTokenIds = useCallback(() => readWrapper<readonly bigint[]>("getAllTokenIds", []), [readWrapper]);
  const isAdministrator = useCallback(async (addr: Address): Promise<boolean | null> => {
      const owner = await readWrapper<Address>("owner");
      if (owner === null) return null;
      if (owner === addr) return true;
      const isAdmin = await readWrapper<boolean>("administrators", [addr]);
      return isAdmin;
  }, [readWrapper]);


  const mintProperty = useCallback(
    async (
      to: Address, cadastralNumber: string, location: string,
      valuation: bigint, metadataURI: string,
      callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }
    ): Promise<Hex | null> => {
      console.log("[Mint Property Check]");
      console.log("  isConnected:", isConnected);
      console.log("  Account:", account);
      console.log("  Chain ID:", chainId);
      console.log("  Contract Address:", contractAddress);
      console.log("  Recipient (to):", to);
      console.log("  Cadastral:", cadastralNumber);
      console.log("  Location:", location);
      console.log("  Valuation:", valuation?.toString());
      console.log("  Metadata URI:", metadataURI);

      if (!isConnected || !account) { const e = new Error("Wallet not connected."); setInternalError(e.message); callbacks?.onError?.(e); return null; }
      if (!contractAddress) { const e = new Error("Contract address not found for this chain."); setInternalError(e.message); callbacks?.onError?.(e); return null; }

      setInternalError(null);
      console.log("Attempting to send mintProperty transaction via hook...");

      try {
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: RealEstateERC721ABI,
          functionName: "mintProperty",
          args: [to, cadastralNumber, location, valuation, metadataURI],
          
        });
        console.log("Transaction submitted via hook with hash:", hash);
        setLastTxHash(hash);
        callbacks?.onSuccess?.(hash);
        return hash;
      } catch (err: any) {
        console.error("Mint Property Hook Error during submission:", err);
      
        console.error("Full Error Object:", err);
        const error = err instanceof Error ? err : new Error("Failed to send mint transaction.");
        setInternalError(error.message);
        callbacks?.onError?.(error);
        return null;
      }
    },
    [contractAddress, account, isConnected, writeContractAsync]
  );

  const writeWrapper = useCallback(
       async (
        functionName: string, args: any[],
        callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }
       ): Promise<void> => {
        if (!isConnected || !account) { const e = new Error("Wallet not connected."); setInternalError(e.message); callbacks?.onError?.(e); return; }
        if (!contractAddress) { const e = new Error("Contract address not found for this chain."); setInternalError(e.message); callbacks?.onError?.(e); return; }
        setInternalError(null); console.log(`Attempting to send ${functionName} transaction...`);
        try {
            const hash = await writeContractAsync({ address: contractAddress, abi: RealEstateERC721ABI, functionName, args });
            console.log(`Transaction ${functionName} submitted with hash:`, hash); setLastTxHash(hash); callbacks?.onSuccess?.(hash);
        } catch (err: any) { console.error(`Error sending ${functionName} tx:`, err); const error = err instanceof Error ? err : new Error(`Failed to send ${functionName} transaction.`); setInternalError(error.message); callbacks?.onError?.(error); }
    }, [contractAddress, account, isConnected, writeContractAsync]
  );

  const updatePropertyValuation = useCallback((tokenId: bigint, newValuation: bigint, callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }) =>
      writeWrapper("updatePropertyValuation", [tokenId, newValuation], callbacks), [writeWrapper] );
  const transferToken = useCallback((from: Address, to: Address, tokenId: bigint, callbacks?: { onSuccess?: (hash: Hex) => void; onError?: (error: Error) => void }) =>
      writeWrapper("transferFrom", [from, to, tokenId], callbacks), [writeWrapper] );

  return { contractAddress, isLoading, isReading, isConfirming, isConfirmed,
           error, txHash: lastTxHash, receipt, getPropertyDetails, getBalanceOf,
           getOwnerOf, getTokenURI, getAllTokenIds, isAdministrator, mintProperty,
           updatePropertyValuation, transferToken };
}
