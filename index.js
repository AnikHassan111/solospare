const express = require('express')
const app = express()
const jwt = require('jsonwebtoken') 
const cookieParser = require('cookie-parser')
const cros = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xrwxj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// // MiddleWare
const corsOption = {
    origin:[
        'http://localhost:5173',
        'https://milestone-11shakil.web.app'
    ],
    credentials:true,
    // optionsSuccessStatus:200
}
app.use(cros(corsOption))
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req,res,next)=>{
    const token = req.cookies.token
    if(!token) return res.status(401).send({message:'unauthorized Access'})
    jwt.verify(token,process.env.ACCESS_TOKEN,(err,decode)=>{

        if(err){
            return res.status(401).send({message:'unauthorized'})
        }
        if(decode){
            req.user = decode
            next()
        }
    })
}


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {



        app.post('/api/v1/jwt',async(req,res)=>{
            const email = req.body.email
            // console.log('email',email)
            const token = await jwt.sign({email},process.env.ACCESS_TOKEN,{expiresIn:'365d'})
            // console.log(token,"dskhflsdfh")
            res.cookie('token',token,{
                httpOnly:true,
                secure:process.env.NODE_ENV ==='production',
                // secure:true,
                sameSite:process.env.NODE_ENV ==='production'?"none":"Strict",
                // sameSite:'none'
            
            }).send({success:true})

        })
        
        // Token Delete
        app.get('/api/v1/tokenDelete',async(req,res)=>{
            res.clearCookie('token',{
                httpOnly:true,
                sameSite:process.env.NODE_ENV === 'production'?'none':'Strict',
                secure:process.env.NODE_ENV === 'production'
            })
            .send({success:true})
        })
        

        const jobCollection = client.db('solosphere').collection('jobs')
        const bidJobCollection = client.db('solosphere').collection('bid_Jobs')


        // All Jobs Data
        app.get('/api/v1/jobs', async (req, res) => {
            // console.log(req.cookies.token)
            
            const result = await jobCollection.find().toArray()
            res.send(result)
        })

        // Post A jobs
        app.post('/api/v1/post_job',async(req,res)=>{
            const body = req.body
            const result = await jobCollection.insertOne(body)
            res.send(result)
        })

        // All Post job fetch
        app.get('/api/v1/myPostJobs/:email',verifyToken,async(req,res)=>{
            // console.log(req.user)
            const email = req.params.email
            const tokenEmail = req.user.email
            if(email !== tokenEmail) return res.status(403).send({message:'forbidden access'})
            const query = {'buyer_Info.email': email }
            const result = await jobCollection.find(query).toArray()
            res.send(result)
        })

        // My Post Job Delete
        app.delete('/api/v1/myPostJobsDelete/:id',async(req,res)=>{
            // console.log(req.id)
            const result = await jobCollection.deleteOne({_id:new ObjectId(req.params.id)})
            res.send(result)
        })
        // Post Jobs Data update
        app.put(`/api/v1/postJobsUpdate/:id`,async(req,res)=>{
            const query = {_id : new ObjectId(req.params.id)} 
            const option = {upsert:true}
            const updateDoc = {
                $set:{
                    ...req.body
                }
            }
            const result = await jobCollection.updateOne(query,updateDoc,option)
            res.send(result)
        })



        // get My Bids
        app.get('/api/v1/mybids/:email',verifyToken,async(req,res)=>{
            const email = req.params.email
            // const query = {email}
            const result = await bidJobCollection.find({email}).toArray()
            // console.log(result)
            res.send(result)
        })
        // My Bids Request
        app.get('/api/v1/bidRequest/:email',verifyToken,async(req,res)=>{
            const email =  req.params.email
            const result = await bidJobCollection.find({buyer_Email:email}).toArray()
            res.send(result)
        })

        // Single Jobs Data
        app.get('/jobsDetails/:_id', async (req, res) => {
            
                const id = req.params._id
                const query = { _id: new ObjectId(id) }
                const result = await jobCollection.findOne(query)
                res.send(result)
            
        })


        // All Data Count

        app.get('/api/v1/allDataCount',async(req,res)=>{
            const fillter = req.query.fillter
            const search = req.query.search
            let query = {
                name:{$regex:search,$options:'i'}
            }
            if(fillter) query = {category:fillter}
            const result = await jobCollection.countDocuments(query)
            res.send({count:result})
        })
        
        // All Jobs Data Sort
        app.get('/api/v1/jobsSort', async (req, res) => {
            
            
            const dataParPage = parseInt(req.query.dataParPage)
            const currentPage = parseInt(req.query.currentPage) - 1
            const fillter = req.query.fillter
            const dateLine = req.query.dateLine
            const search = req.query.search
            // console.log(dataParPage,currentPage)

            let sortByDateLine = {}
            let query = {
                name:{$regex:search,$options:'i'}
            }

            if(dateLine) dateLine === 'Decending Order'? sortByDateLine = {dateline: -1}:  {dateline: 1}
            console.log(fillter)
            if(fillter) query = {category:fillter}
            
            const result = await jobCollection.find(query).sort(sortByDateLine).skip(currentPage * dataParPage).limit(dataParPage).toArray()
            res.send(result)
        })

        // UpdateStatus

        app.patch('/api/v1/updateStatus/:id',async(req,res)=>{
            const id = req.params.id
            const body = req.body
            const query = {_id:new ObjectId(id)}
            const updateDoc = {
                $set:{
                    status:body.process
                }
            }
            const result = await bidJobCollection.updateOne(query,updateDoc)
            res.send(result)
        })

        app.post('/api/v1/bid_jobs',async(req,res)=>{
            const body = req.body
            const alreadyBidJobs = await bidJobCollection.findOne({email:body.email,jobs_id:body.jobs_id})
            if(alreadyBidJobs){
                return res.status(400).send('All Ready Bid This Jobs')
            }
            const result = await bidJobCollection.insertOne(body)
            res.send(result)
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }

    catch (err) {
        res.send(err)
    }

    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Server is runnitn")
})


app.listen(port, () => {
    console.log('Server is runnitn')
})

