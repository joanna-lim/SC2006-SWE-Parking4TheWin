from flask import Blueprint, render_template, request, flash, redirect, url_for
from .models import *
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user
from functools import wraps
import re

auth = Blueprint('auth', __name__)

def role_required(role):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('auth.get_driver_login'))
            elif current_user.user_type=='driver' and role=='corporate':
                # flash('That URL is blocked for your account type!', category='error')
                return redirect(url_for('views.home'))
            elif current_user.user_type=='corporate' and role=='driver':
                # flash('That URL is blocked for your account type!', category='error')
                return redirect(url_for('views.get_rewards_creation'))
            return fn(*args, **kwargs)
        return decorated_view
    return wrapper

@auth.route('/login/driver', methods=['GET'])
def get_driver_login():
    return render_template("driver_login.html", user=current_user)

@auth.route('/login/driver', methods=['POST'])
def post_driver_login():
    email = request.form.get('email')
    password = request.form.get('password')

    if len(email) > 150 or len(password) > 150:
        flash('Input is too long!', 'error')
        return get_driver_login
    
    driver = Driver.query.filter_by(email=email).first()

    if driver:
        if check_password_hash(driver.password, password):
            driver = User.query.filter_by(id=driver.user_id).first()
            login_user(driver, remember=True)
            return redirect(url_for('views.home'))
        else:
            flash('Wrong password! :(', category='error')
    else:
        flash('Email doesn\'t exist!', category='error')

    return get_driver_login()

@auth.route('/login/corporate', methods=['GET'])
def get_corporate_login():
    return render_template("corporate_login.html", user=current_user)

@auth.route('/login/corporate', methods=['POST'])
def post_corporate_login():
    uen = request.form.get('uen')
    password = request.form.get('password')

    if len(uen) > 150 or len(password) > 150: 
        flash('Input is too long!', 'error')
        return get_corporate_login()

    company = Company.query.filter_by(uen=uen).first()

    if company:
        if check_password_hash(company.password, password):
            company = User.query.filter_by(id=company.user_id).first()
            login_user(company, remember=True)
            return redirect(url_for('views.home'))
        else:
            flash('Wrong password!', 'error')
    else:
        flash('UEN doesn\'t exist!', 'error')

    return get_corporate_login()

@auth.route('/logout', methods=['GET'])
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.get_driver_login'))

@auth.route('/signup/driver', methods=['GET'])
def get_driver_signup():
    return render_template("driver_sign_up.html", user=current_user)

@auth.route('/signup/driver', methods=['POST'])
def post_driver_signup():
    password_pattern = r"^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    email = request.form.get('email')
    first_name = request.form.get('firstName')
    password1 = request.form.get('password1')
    password2 = request.form.get('password2')

    driver = Driver.query.filter_by(email=email).first()

    """
    account creation restrictions:
    - unique email
    - password must be at least 8 characters
    """
    if driver:
        flash('An account has already been created with this email!', 'error')
    
    elif len(email)<1:
        flash('Email cannot be empty!', 'error')
    
    elif len(email) > 150:
        flash('Email is too long!', 'error')

    elif not re.match(email_pattern, email):
        flash('Email is invalid. Email must be of the form x@x.xx .' 'error')

    elif len(first_name) < 1:
        flash('Name cannot be empty!')
    
    elif len(first_name) > 150:
        flash('Name is too long!', 'error')    

    elif not re.match(password_pattern, password1):
        flash('Password should have at least 1 character, 1 digit and 1 special character!', 'error')
    
    elif len(password1) > 150:
        flash('Password is too long!', 'error')
    
    elif len(password1) < 8:
        flash('Password should be at least 8 characters!', 'error')
        
    elif password1!=password2:
        flash('Passwords don\'t match!', 'error')
        
    else:
        # add user to database
        new_driver = User(user_type="driver")
        db.session.add(new_driver)
        db.session.commit()
        login_user(new_driver,remember=True)
        new_driver = Driver(email=email, first_name=first_name, password=generate_password_hash(password1,method='sha256'),user_id=current_user.id, points=0)
        db.session.add(new_driver)
        db.session.commit()
        return redirect(url_for('views.home'))
    
    return get_driver_signup()

@auth.route('/signup/corporate', methods=['GET'])
def get_corporate_sign_up():
    return render_template("corporate_sign_up.html", user=current_user)

@auth.route('/signup/corporate', methods=['POST'])
def post_corporate_sign_up():
    password_pattern = r"^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
    uen = request.form.get('uen')
    company_name = request.form.get('companyName')
    password1 = request.form.get('password1')
    password2 = request.form.get('password2')

    company = Company.query.filter_by(uen=uen).first()

    """
    account creation restrictions:
    - unique UEN
    - password must be at least 8 characters
    """

    if company:
        flash('An account has already been created with this UEN!', 'error')
    
    elif len(uen) < 1:
        flash('UEN cannot be empty!', 'error')
    
    elif len(uen) > 150:
        flash('UEN is too long!', 'error')
    
    elif len(company_name) < 1:
        flash('Company name cannot be empty!', 'error')

    elif len(company_name) > 150:
        flash('Company name is too long!', 'error')

    elif not re.match(password_pattern, password1):
        flash('Password should have at least 1 character, 1 digit and 1 special character!', 'error')
    
    elif len(password1) >150:
        flash('Password is too long!')
    
    elif len(password1) < 8:
        flash('Password should be at least 8 characters!', 'error')
        
    elif password1!=password2:
        flash('Passwords don\'t match!', 'error')
        
    else:
        # add user to database
        new_company = User(user_type="corporate")
        db.session.add(new_company)
        db.session.commit()
        login_user(new_company,remember=True)
        new_company = Company(uen=uen, company_name = company_name, password=generate_password_hash(password1,method='sha256'), user_id=current_user.id)
        db.session.add(new_company)
        db.session.commit()
        
        flash('Corporate Account successfully created!', 'success')
        return redirect(url_for('views.home'))
        
    return get_corporate_sign_up()