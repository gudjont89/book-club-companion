import express from "express";
import cors from "cors";
import { booksRouter } from "./routes/books";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/books", booksRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
