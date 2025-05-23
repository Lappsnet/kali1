"use client"

import { useState, useEffect } from "react"
import { useAppKitAccount } from "@reown/appkit/react"
import { DollarSign, MapPin, Calendar, Tag } from "lucide-react"
import { useRealEstateSaleContract } from "../hooks/useRealEstateSaleContract"
import { useRealEstateContract, type UseRealEstateContractReturn } from "../hooks/useRealEstateContract"
import { formatEther } from "viem"

interface Listing {
  id: string
  propertyId: string
  title: string
  description: string
  price: string
  location: string
  status: "active" | "pending" | "sold"
  image: string
  seller: string
  createdAt: string
}

export const ActiveListings = () => {
  const { isConnected } = useAppKitAccount()
  const { getSale, getActiveSaleForProperty } = useRealEstateSaleContract()
  const { getAllTokenIds, getPropertyDetails } = useRealEstateContract() as UseRealEstateContractReturn
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "sold">("all")

  useEffect(() => {
    const fetchListings = async () => {
      try {
        // Get all properties and their active sales
        const properties = await getAllTokenIds()
        if (!properties) {
          setError("Failed to fetch properties")
          return
        }

        const activeListings: Listing[] = []
        for (const propertyId of properties) {
          const saleId = await getActiveSaleForProperty(propertyId)
          if (saleId) {
            const sale = await getSale(saleId)
            const propertyDetails = await getPropertyDetails(propertyId)
            if (sale && propertyDetails) {
              activeListings.push({
                id: saleId.toString(),
                propertyId: propertyId.toString(),
                title: propertyDetails.metadata.name,
                description: propertyDetails.metadata.description,
                price: sale.price.toString(),
                location: propertyDetails.location,
                status: sale.status === 1 ? "active" : sale.status === 2 ? "pending" : "sold",
                image: propertyDetails.metadata.image,
                seller: sale.seller,
                createdAt: new Date(Number(sale.createdAt) * 1000).toISOString()
              })
            }
          }
        }
        setListings(activeListings)
      } catch (err) {
        setError("Failed to fetch listings")
      } finally {
        setLoading(false)
      }
    }

    fetchListings()
  }, [getSale, getActiveSaleForProperty, getAllTokenIds, getPropertyDetails])

  const filteredListings = listings.filter(
    (listing) => filter === "all" || listing.status === filter
  )

  if (!isConnected) {
    return (
      <div className="page-container">
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view active listings</p>
          <appkit-button />
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading">Loading listings...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Active Listings</h1>
        <p>Browse and manage property listings</p>
      </div>

      <div className="listings-filters">
        <div className="filter-buttons">
          <button
            className={`filter-button ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-button ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button
            className={`filter-button ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`filter-button ${filter === "sold" ? "active" : ""}`}
            onClick={() => setFilter("sold")}
          >
            Sold
          </button>
        </div>
      </div>

      <div className="listings-grid">
        {filteredListings.map((listing) => (
          <div key={listing.id} className="listing-card">
            <div className="listing-image">
              <img src={listing.image} alt={listing.title} />
              <span className={`status-badge ${listing.status}`}>{listing.status}</span>
            </div>
            <div className="listing-details">
              <h3>{listing.title}</h3>
              <p>{listing.description}</p>
              <div className="listing-info">
                <div className="info-item">
                  <DollarSign size={16} />
                  <span>{formatEther(BigInt(listing.price))} ETH</span>
                </div>
                <div className="info-item">
                  <MapPin size={16} />
                  <span>{listing.location}</span>
                </div>
                <div className="info-item">
                  <Calendar size={16} />
                  <span>Listed: {new Date(listing.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="info-item">
                  <Tag size={16} />
                  <span>ID: {listing.propertyId}</span>
                </div>
              </div>
            </div>
            <div className="listing-actions">
              <button className="action-button view">View Details</button>
              <button className="action-button buy">Buy Now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 