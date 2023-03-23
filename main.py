from website import create_app
from dotenv import load_dotenv

load_dotenv()
app = create_app()

if __name__ == '__main__':
    # Threading doesn't work well with reloader especially on Windows
    # If you want the reloader, comment out the line below and and
    # t1.start() t2.start() in __init__.py
    app.run(debug=True, use_reloader=False)
    #app.run(debug=True)