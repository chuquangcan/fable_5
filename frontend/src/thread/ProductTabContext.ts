import { createContext, useContext } from 'react'

/** The product (thread) tab a component belongs to: its id keys the tab's state in the store. */
export const ProductTabContext = createContext<string | null>(null)

export const useProductTab = () => useContext(ProductTabContext)
