import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_API_KEY!,{
    apiVersion:"2026-04-22.dahlia",
    typescript:true
})
