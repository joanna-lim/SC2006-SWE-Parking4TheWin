from flask import Flask, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
import os
from flask_login import LoginManager, current_user
from functools import wraps

db = SQLAlchemy()
DB_NAME = "database.db"

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.urandom(24)
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_NAME}'
    db.init_app(app)
    
    from .views import views
    from .auth import auth

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')

    from .models import User

    with app.app_context():
        db.create_all()
    
    login_manager = LoginManager()
    login_manager.login_view = 'auth.driver_login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id)) #telling flask how we load a user

    def role_required(role):
        def wrapper(fn):
            @wraps(fn)
            def decorated_view(*args, **kwargs):
                if not current_user.is_authenticated or current_user.role != role:
                    # redirect to unauthorized page or show error message
                    return redirect(url_for('unauthorized'))
                return fn(*args, **kwargs)
            return decorated_view
        return wrapper

    return app
 