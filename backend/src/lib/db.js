import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn =  await mongoose.connect(process.env.DB_URI);
    console.log(`MDB connected ${conn.connection.host}`)
  }
  catch (error){
    console.log(error)
    process.exit(1)
  };
}