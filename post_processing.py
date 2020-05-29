from processing import engine
import pandas as pd


def get_heads():
    query = ""
    with engine.connect() as conn:
        df = pd.read_sql(query)


if __name__ == "__main__":
    print(engine)
