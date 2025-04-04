import mongoose from "mongoose";
import type { Connection } from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();


// Get cached connection if there is one
let cachedConnection: Connection | null = null;

const MONGODB_URI = process.env.NEXT_PUBLIC_MONGODB_URI;

const connectToMongoDB = async (): Promise<Connection> => {
  // console.log(`URI - ${MONGODB_URI}`);

  if (cachedConnection) {
    console.log("Using cached db connection");
    return cachedConnection;
  }
  if (!MONGODB_URI) {
    throw new Error("MongoDB URI is not defined");
  }
  try {
    const connection = await mongoose.connect(MONGODB_URI);
    cachedConnection = connection.connection;
    // Log message indicating a new MongoDB connection is established
    console.log("New mongodb connection established");
    // Return the newly established connection
    return cachedConnection;
  } catch (error) {
    // If an error occurs during connection, log the error and throw it
    console.log(error);
    throw error;
  }
};

export default connectToMongoDB;
