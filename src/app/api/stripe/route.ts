import { userSubscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {db} from "@/lib/db"
import {eq} from "drizzle-orm"

let baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `http://${baseUrl}`;
}
const return_url = `${baseUrl}/account`;
export async function GET(){
    try {
        const {userId}=await auth()
        const user = await currentUser()

        if (!userId){
            return new NextResponse("unauthorised", {status:401})
        }

        const _userSubscriptions= await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId,userId))
        if (_userSubscriptions[0] && _userSubscriptions[0].stripeCustomerId){
            const stripeSession=await stripe.billingPortal.sessions.create({
                customer:_userSubscriptions[0].stripeCustomerId,
                return_url
            })
            return NextResponse.json({url:stripeSession.url})
        }

        const stripeSession=await stripe.checkout.sessions.create({
            success_url:return_url,
            cancel_url:return_url,
            payment_method_types:["card"],
            mode:"subscription",
            billing_address_collection:"auto",
            customer_email:user?.emailAddresses[0].emailAddress,
            line_items:[{
                price_data:{
                    currency:"USD",
                    product_data:{
                        name:"ChatPDF PRO",
                        description:"Unlimited PDF sessions!"
                    },
                    unit_amount:2000,
                    recurring:{
                        interval:"month"
                    }
                },
                quantity:1
            }],
            metadata:{userId}
        })
        return NextResponse.json({url:stripeSession.url})
    } catch (error) {
        console.log("stripe error",error)
        return new NextResponse("internal server error",{status:500})
    }
}