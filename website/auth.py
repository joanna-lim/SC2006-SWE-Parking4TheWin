from flask import Blueprint, render_template, request, flash, redirect, url_for
from .models import User
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
from functools import wraps

auth = Blueprint('auth', __name__)

def role_required(role):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if not current_user.is_authenticated or current_user.role != role:
                return redirect(url_for('auth.driver_login'))
            return fn(*args, **kwargs)
        return decorated_view
    return wrapper

@auth.route('/driver-login', methods=['GET', 'POST'])
def driver_login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        driver = User.query.filter_by(email=email).first()

        if driver:
            if check_password_hash(driver.password, password):
                login_user(driver, remember=True)
                return redirect(url_for('views.home'))
            else:
                flash('Wrong password! :(', category='error')
        else:
            flash('Email doesn\'t exist!', category='error')
    return render_template("driver_login.html", user=current_user)

@auth.route('/corporate-login', methods=['GET', 'POST'])
def corporate_login():
    if request.method == 'POST':
        uen = request.form.get('uen')
        password = request.form.get('password')

        company = User.query.filter_by(uen=uen).first()

        if company:
            if check_password_hash(company.password, password):
                login_user(company, remember=True)
                return redirect(url_for('views.home'))
            else:
                flash('Wrong password! :(', category='error')
        else:
            flash('UEN doesn\'t exist!', category='error')
    return render_template("corporate_login.html", user=current_user)

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.driver_login'))

@auth.route('/driver-sign-up', methods=['GET', 'POST'])
def driver_sign_up():
    if request.method == 'POST':
        email = request.form.get('email')
        first_name = request.form.get('firstName')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')

        driver = User.query.filter_by(email=email).first()

        """
        account creation restrictions:
        - unique email
        - password must be at least 8 characters
        """

        if driver:
            flash('An account has already been created with this email', category='error')
        
        elif len(password1) < 8:
            flash('Password should be at least 8 characters :(', category='error')
            
        elif password1!=password2:
            flash('Passwords don\'t match :(', category='error')
            
        else:
            # add user to database
            new_driver = User(email=email, first_name=first_name, password=generate_password_hash(password1,method='sha256'), user_type="driver")
            db.session.add(new_driver)
            db.session.commit()
            login_user(new_driver,remember=True)
            flash('Account created! :)', category='success')
            return redirect(url_for('views.home'))
    return render_template("driver_sign_up.html", user=current_user)
        
@auth.route('/corporate-sign-up', methods=['GET', 'POST'])
def corporate_sign_up():
    if request.method == 'POST':
        uen = request.form.get('uen')
        company_name = request.form.get('companyName')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')

        company = User.query.filter_by(uen=uen).first()

        """
        account creation restrictions:
        - unique UEN
        - password must be at least 8 characters
        """

        if company:
            flash('An account has already been created with this UEN', category='error')
        
        elif len(password1) < 8:
            flash('Password should be at least 8 characters :(', category='error')
            
        elif password1!=password2:
            flash('Passwords don\'t match :(', category='error')
            
        else:
            # add user to database
            new_company = User(uen=uen, company_name = company_name, password=generate_password_hash(password1,method='sha256'), user_type="corporate")
            db.session.add(new_company)
            db.session.commit()
            login_user(new_company,remember=True)
            flash('Account created! :)', category='success')
            return redirect(url_for('views.home'))
        
    return render_template("corporate_sign_up.html", user=current_user)

    
